import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const OPENAI_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

    const apiKey = Deno.env.get("Api_key");
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    const startTime = Date.now();

    // --- CONTEXT ASSEMBLY AGENT ---
    const messages = await base44.entities.Message.filter(
      { conversation_id: conversationId },
      '-created_date',
      20
    );
    const history = [...messages].reverse();

    const memories = await base44.entities.Memory.filter(
      { workspace_id: workspaceId, is_enabled: true },
      '-importance',
      10
    );

    const workspace = await base44.entities.Workspace.get(workspaceId);

    // Build system prompt with workspace instructions and memories
    let systemPrompt = 'You are COGNOS, an intelligent AI reasoning assistant. You provide thoughtful, accurate, and helpful responses. Use markdown formatting when appropriate for clarity.';
    if (workspace.instructions) {
      systemPrompt += `\n\nWORKSPACE INSTRUCTIONS:\n${workspace.instructions}`;
    }
    if (memories && memories.length > 0) {
      systemPrompt += `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}`;
    }

    // Build chat messages array
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: userMessage }
    ];

    // --- ORCHESTRATOR AGENT: Main LLM call via OpenAI ---
    const llmResponse = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://cognos.app',
        'X-Title': 'COGNOS'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: chatMessages,
        max_tokens: 2000
      })
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      return Response.json({ error: `Model API error (${llmResponse.status}): ${errText}` }, { status: 502 });
    }

    const llmData = await llmResponse.json();
    const responseText = llmData.choices[0].message.content;

    // --- MEMORY AGENT: Extract memories (best-effort) ---
    try {
      const memResponse = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a memory extraction agent. Analyze the conversation and extract any important facts, preferences, or information worth remembering for future conversations. Only extract genuinely useful, long-term information — not casual conversation. Return a JSON object with a "memories" array. Each memory has "content" (string), "memory_type" ("episodic" or "semantic"), and "importance" (1-10 integer). Return {"memories": []} if nothing is worth remembering.'
            },
            {
              role: 'user',
              content: `User: ${userMessage}\nAssistant: ${responseText}`
            }
          ],
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      });

      if (memResponse.ok) {
        const memData = await memResponse.json();
        const memResult = JSON.parse(memData.choices[0].message.content);

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
      }
    } catch (_memError) {
      // Memory extraction is best-effort
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
        model_used: 'openai/gpt-4o',
        task_type: 'conversation',
        latency_ms: latency,
        status: 'success'
      });
    } catch (_auditError) {
      // Best-effort
    }

    return Response.json({
      response: responseText,
      taskType: 'conversation',
      modelUsed: 'openai/gpt-4o',
      latencyMs: latency
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});