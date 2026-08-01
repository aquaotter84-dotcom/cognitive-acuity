// Orchestrator — the dispatcher. Runs a registered agent against a protocol message,
// emitting lifecycle events on the bus and routing results/errors back to the caller.
// Phase 1: sequential dispatch. Later phases add parallel/branching collaboration.

import { runAgent } from "./runtime.ts";

export function createOrchestrator({ registry, eventBus, logger }) {
  async function dispatch(stageName, message, ctx) {
    if (!registry.has(stageName)) throw new Error(`Stage not registered: ${stageName}`);
    const agent = registry.get(stageName);
    await eventBus.publish("orchestration.stage.start", { stage: stageName, messageId: message.id });
    try {
      const result = await runAgent(agent, message, ctx);
      await eventBus.publish("orchestration.stage.complete", { stage: stageName, messageId: message.id, status: "success" });
      return result;
    } catch (e) {
      await eventBus.publish("orchestration.stage.complete", { stage: stageName, messageId: message.id, status: "error", error: String(e) });
      throw e;
    }
  }

  return { dispatch };
}