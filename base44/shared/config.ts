// Configuration system — central system configuration. Phase 1 ships static defaults;
// later phases can extend this to read from workspace/entity-backed settings.

export function getSystemConfig() {
  return Object.freeze({
    orchestrator: {
      maxHistoryMessages: 20,
      maxMemories: 10
    },
    models: {
      primary: "openai/gpt-4o",
      memory: "openai/gpt-4o-mini"
    },
    limits: {
      responseMaxTokens: 2000,
      memoryMaxTokens: 500
    },
    council: {
      observerModel: "openai/gpt-4o-mini",
      observerMaxTokens: 300,
      strategistModel: "openai/gpt-4o-mini",
      strategistMaxTokens: 400,
      criticModel: "openai/gpt-4o-mini",
      criticMaxTokens: 400,
      criticEnabled: true,
      governorEnabled: true
    }
  });
}