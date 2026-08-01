// Council — cognitive operator registry. Registers every council stage with the
// agent registry so the orchestrator can dispatch them as pipeline stages.
// Phase 2: Observer, Strategist, Critic, Governor.
// Phase 3: Specialist (execution), Synthesizer (integration).

import { observerAgent } from "./observer.ts";
import { strategistAgent } from "./strategist.ts";
import { specialistAgent } from "./specialist.ts";
import { synthesizerAgent } from "./synthesizer.ts";
import { criticAgent } from "./critic.ts";
import { governorAgent } from "./governor.ts";

export { observerAgent, strategistAgent, specialistAgent, synthesizerAgent, criticAgent, governorAgent };

export function registerCouncil(registry) {
  registry.register(observerAgent.name, observerAgent);
  registry.register(strategistAgent.name, strategistAgent);
  registry.register(specialistAgent.name, specialistAgent);
  registry.register(synthesizerAgent.name, synthesizerAgent);
  registry.register(criticAgent.name, criticAgent);
  registry.register(governorAgent.name, governorAgent);
}