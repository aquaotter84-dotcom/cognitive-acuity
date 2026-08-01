// Council operators — the cognitive roles. Imported by the shared pipeline
// (runCouncil), which calls them directly. Phase 2: Observer, Strategist,
// Critic, Governor. Phase 3: Specialist (execution), Synthesizer (integration).

import { observerAgent } from "./observer.ts";
import { strategistAgent } from "./strategist.ts";
import { specialistAgent } from "./specialist.ts";
import { synthesizerAgent } from "./synthesizer.ts";
import { criticAgent } from "./critic.ts";
import { governorAgent } from "./governor.ts";
import { webSearchAgent } from "./webSearch.ts";

export {
  observerAgent,
  strategistAgent,
  specialistAgent,
  synthesizerAgent,
  criticAgent,
  governorAgent,
  webSearchAgent
};