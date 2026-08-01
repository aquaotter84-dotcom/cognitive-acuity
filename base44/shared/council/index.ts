// Council — Phase 2 first cognitive layer. Registers the four council operators with
// the agent registry so the orchestrator can dispatch them as pipeline stages.

import { observerAgent } from "./observer.ts";
import { strategistAgent } from "./strategist.ts";
import { criticAgent } from "./critic.ts";
import { governorAgent } from "./governor.ts";

export { observerAgent, strategistAgent, criticAgent, governorAgent };

export function registerCouncil(registry) {
  registry.register(observerAgent.name, observerAgent);
  registry.register(strategistAgent.name, strategistAgent);
  registry.register(criticAgent.name, criticAgent);
  registry.register(governorAgent.name, governorAgent);
}