import { callLLM, buildContextSystemPrompt, styleDirective } from "./llm.js";

const OBSERVER_SCHEMA = {
  type: "object",
  properties: {
    task_type: { type: "string" },
    complexity: { type: "string" },
    needs_decomposition: { type: "boolean" },
    intent: { type: "string" }
  }
};

const DECOMP_SCHEMA = {
  type: "object",
  properties: {
    sub_tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          agent: { type: "string" },
          description: { type: "string" },
          input: { type: "string" }
        }
      }
    }
  }
};

const CRITIC_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    reasoning: { type: "string" },
    needs_revision: { type: "boolean" },
    charter: {
      type: "object",
      properties: {
        truth: { type: "boolean" },
        evidence: { type: "boolean" },
        agency: { type: "boolean" },
        dignity: { type: "boolean" },
        note: { type: "string" }
      }
    }
  }
};

const ALLOWED_AGENTS = ["research", "coding", "analysis", "planning", "creative", "decision_support", "question_answering", "action_execution"];
const PRIMARY_MODEL = process.env.COGNOS_PRIMARY_MODEL || process.env.BLUESMINDS_MODEL || "gpt_5_4";
const MEMORY_MODEL = process.env.COGNOS_MEMORY_MODEL || "gpt_5_mini";

const SPECIALIST_PROMPTS = {
  research: "You are a Research specialist. Investigate the assigned question thoroughly and return concrete, organized findings.",
  coding: "You are a Coding specialist. Produce correct, well-structured code for the assigned task with brief explanations.",
  analysis: "You are an Analysis specialist. Analyze the task rigorously, surface trade-offs, assumptions, and key insights.",
  planning: "You are a Planning specialist. Produce an actionable, sequenced plan with clear steps.",
  creative: "You are a Creative specialist. Produce imaginative, original work appropriate to the assigned task.",
  decision_support: "You are a Decision Support specialist. Lay out options, criteria, risks, and a recommendation.",
  question_answering: "You are a Question Answering specialist. Answer accurately and concisely.",
  action_execution: "You are an Action Execution specialist. Carry out the assigned task as far as possible and report what was done.",
  conversation: "You are a Conversation specialist. Respond helpfully and naturally."
};

async function observer(userMessage) {
  const fallback = { task_type: "conversation", complexity: "simple", needs_decomposition: false, intent: "unclassified" };
  try {
    const classification = await callLLM({
      model: MEMORY_MODEL,
      responseJsonSchema: OBSERVER_SCHEMA,
      messages: [
        { role: "system", content: "You are the Observer of the COGNOS council. Classify the user's request. Use task_type from conversation, question_answering, research, planning, coding, analysis, creative, decision_support, action_execution. Set complexity to simple, moderate, or complex. Set needs_decomposition true only for genuinely multi-step or multi-domain work. Give a short intent." },
        { role: "user", content: userMessage }
      ]
    });
    return classification?.task_type ? classification : fallback;
  } catch {
    return fallback;
  }
}

async function strategist(userMessage, classification) {
  if (!classification.needs_decomposition) return { plan: "direct", sub_tasks: [] };
  try {
    const result = await callLLM({
      model: MEMORY_MODEL,
      responseJsonSchema: DECOMP_SCHEMA,
      messages: [
        { role: "system", content: `You are the Strategist of the COGNOS council. Decompose the goal into 2-4 independent specialist tasks. Agents must be one of: ${ALLOWED_AGENTS.join(", ")}.` },
        { role: "user", content: userMessage }
      ]
    });
    const sub_tasks = Array.isArray(result?.sub_tasks)
      ? result.sub_tasks.filter(s => ALLOWED_AGENTS.includes(s.agent)).slice(0, 4).map((s, i) => ({ id: s.id || `s${i + 1}`, ...s }))
      : [];
    return sub_tasks.length ? { plan: "decomposed", sub_tasks } : { plan: "direct", sub_tasks: [] };
  } catch {
    return { plan: "direct", sub_tasks: [] };
  }
}

async function specialist(input, classification, plan) {
  const { userMessage, history = [], memories = [], workspace, style } = input;
  if (plan.sub_tasks.length) {
    const outputs = await Promise.all(plan.sub_tasks.map(async st => {
      try {
        const output = await callLLM({
          model: PRIMARY_MODEL,
          messages: [
            { role: "system", content: (SPECIALIST_PROMPTS[st.agent] || SPECIALIST_PROMPTS.conversation) + styleDirective(style) },
            { role: "user", content: st.input || st.description || userMessage }
          ]
        });
        return { ...st, output, status: "complete" };
      } catch (error) {
        return { ...st, output: "", status: "error", error: String(error) };
      }
    }));
    return { needsSynthesis: true, subTaskOutputs: outputs, responseText: null };
  }

  const systemPrompt = buildContextSystemPrompt(workspace, memories, classification) + styleDirective(style);
  const responseText = await callLLM({
    model: PRIMARY_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage }
    ]
  });
  return { needsSynthesis: false, subTaskOutputs: null, responseText };
}

async function synthesize(input, classification, specialistResult) {
  if (!specialistResult.needsSynthesis) return specialistResult.responseText;
  const brief = specialistResult.subTaskOutputs.map((o, i) => `### Sub-task ${i + 1}: ${o.description || o.agent}\n${o.output || "(no output)"}`).join("\n\n");
  return callLLM({
    model: PRIMARY_MODEL,
    messages: [
      { role: "system", content: buildContextSystemPrompt(input.workspace, input.memories, classification) + "\nYou are the Synthesizer of the COGNOS council. Integrate the specialist outputs into one coherent answer. Resolve overlap and do not invent claims beyond the supplied work." + styleDirective(input.style) },
      ...input.history.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: `Original request:\n${input.userMessage}\n\nSpecialist outputs:\n${brief}` }
    ]
  });
}

async function critic(userMessage, responseText) {
  try {
    return await callLLM({
      model: MEMORY_MODEL,
      responseJsonSchema: CRITIC_SCHEMA,
      messages: [
        { role: "system", content: "You are the Critic of the COGNOS council. Score the response 1-10. Mark needs_revision true only if it is clearly inadequate, incorrect, or violates truth, evidence, agency, or dignity. Return concise reasoning." },
        { role: "user", content: `Request: ${userMessage}\n\nResponse: ${responseText}` }
      ]
    });
  } catch (error) {
    return { skipped: true, reason: String(error) };
  }
}

function governor(responseText) {
  const flags = [];
  if (!String(responseText || "").trim()) flags.push("empty_response");
  if (/sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/i.test(responseText || "")) flags.push("potential_secret_leak");
  return { approved: flags.length === 0, flags };
}

export async function runCouncil(input) {
  const classification = await observer(input.userMessage);
  const plan = await strategist(input.userMessage, classification);
  const specialistResult = await specialist(input, classification, plan);
  let responseText = await synthesize(input, classification, specialistResult);

  let evaluation = await critic(input.userMessage, responseText);
  let revisionCount = 0;
  const maxRevisions = 1;
  if (!evaluation.skipped && evaluation.needs_revision === true && Number(evaluation.score) < 6 && revisionCount < maxRevisions) {
    revisionCount++;
    responseText = await callLLM({
      model: PRIMARY_MODEL,
      messages: [
        { role: "system", content: "You are the COGNOS Synthesizer revising a previous response. Correct the problems identified by the Critic. Output only the improved response." },
        { role: "user", content: `Original request:\n${input.userMessage}\n\nPrevious response:\n${responseText}\n\nCritic:\n${evaluation.reasoning}\n\nRevised response:` }
      ]
    });
    evaluation = await critic(input.userMessage, responseText);
  }

  const governance = governor(responseText);
  return {
    responseText,
    classification,
    plan,
    critic: evaluation,
    revisions: { count: revisionCount, maxRevisions },
    governor: governance,
    modelUsed: PRIMARY_MODEL
  };
}
