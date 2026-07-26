import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { conversationId, workspaceId, userMessage } = body;
    if (!conversationId || !workspaceId || !userMessage) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const startTime = Date.now();

    // --- CONTEXT ASSEMBLY AGENT ---
    // 1. Load recent conversation messages
    const messages = await base44.entities.Message.filter(
      { conversation_id: conversationId },
      '-created_date',
      20
    );
    const history = [...messages].reverse();

    // 2. Load relevant memories (top 10 by importance, enabled only)
    const memories = await base44.entities.Memory.filter(
      { workspace_id: workspaceId, is_enabled: true },
      '-importance',
      10
    );

    // 3. Load workspace instructions
    const workspace = await base44.entities.Workspace.get(workspaceId);

    // 4. Assemble context prompt
    let prompt = 'You are COGNOS, an intelligent AI reasoning assistant. You provide thoughtful, accurate, and helpful responses. Use markdown formatting when appropriate for clarity.\n\n';

    if (workspace.instructions) {
      prompt += `WORKSPACE INSTRUCTIONS:\n${workspace.instructions}\n\n`;
    }
    if (memories && memories.length > 0) {
      prompt += `RELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}\n\n`;
    }
    if (history.length > 0) {
      prompt += `CONVERSATION HISTORY:\n`;
      for (const msg of history) {
        if (msg.role === 'user') prompt += `User: ${msg.content}\n`;
        else if (msg.role === 'assistant') prompt += `Assistant: ${msg.content}\n`;
      }
      prompt += '\n';
    }
    prompt += `User: ${userMessage}\n`;

    // --- ORCHESTRATOR AGENT: Main LLM call ---
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'automatic'
    });

    const responseText = typeof llmResponse === 'string'
      ? llmResponse
      : (llmResponse?.response || llmResponse?.text || String(llmResponse || ''));

    // --- MEMORY AGENT: Extract memories (best-effort) ---
    try {
      const memResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Analyze this conversation exchange and extract any important facts, preferences, or information worth remembering for future conversations. Only extract genuinely useful, long-term information — not casual conversation or trivial details. Return an empty array if nothing is worth remembering.\n\nUser: ${userMessage}\nAssistant: ${responseText}`,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            memories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  memory_type: { type: 'string', enum: ['episodic', 'semantic'] },
                  importance: { type: 'integer' }
                }
              }
            }
          }
        }
      });

      if (memResult?.memories && memResult.memories.length > 0) {
        const records = memResult.memories
          .filter(m => m.content && m.content.trim().length > 5)
          .map(m => ({
            workspace_id: workspaceId,
            content: m.content.trim(),
            memory_type: m.memory_type || 'episodic',
            source: conversationId,
            importance: m.importance || 5,
            is_enabled: true
          }));
        if (records.length > 0) {
          await base44.entities.Memory.bulkCreate(records);
        }
      }
    } catch (_memError) {
      // Memory extraction is best-effort — don't fail the response
    }

    // --- AUDIT LOG ---
    const latency = Date.now() - startTime;
    try {
      await base44.entities.AuditEvent.create({
        user_id: user.id,
        workspace_id: workspaceId,
        conversation_id: conversationId,
        event_type: 'agent_invocation',
        agent_type: 'orchestrator',
        model_used: 'automatic',
        task_type: 'conversation',
        latency_ms: latency,
        status: 'success'
      });
    } catch (_auditError) {
      // Audit logging is best-effort
    }

    return Response.json({
      response: responseText,
      taskType: 'conversation',
      modelUsed: 'automatic',
      latencyMs: latency
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});