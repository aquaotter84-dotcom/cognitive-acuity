// Core runtime — the agent contract. A plain factory; dispatch is handled by
// the shared council pipeline (runCouncil), so there is no separate
// orchestrator/registry/eventBus layer. Operators are plain async functions.

export function defineAgent({ name, type = "handler", handle }) {
  if (!name || typeof name !== "string") throw new Error("Agent requires a name");
  if (typeof handle !== "function") throw new Error(`Agent "${name}" requires a handle() function`);
  return { name, type, handle };
}