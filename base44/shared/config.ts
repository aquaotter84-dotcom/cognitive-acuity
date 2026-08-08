// Configuration system — central system configuration.
// Council LLM calls use the shared BluesMinds HTTP adapter. Model names are
// BluesMinds/OpenAI-compatible model identifiers and can be overridden by the
// runtime environment where the external adapter is deployed.

export function getSystemConfig() {
  return Object.freeze({
    orchestrator: {
      maxHistoryMessages: 20,
      maxMemories: 10,
      memoryPoolSize: 20,
      summaryEnabled: true
    },
    models: {
      primary: "gpt_5_4",
      memory: "gpt_5_mini"
    },
    council: {
      observerModel: "gpt_5_mini",
      strategistModel: "gpt_5_mini",
      criticModel: "gpt_5_mini",
      criticEnabled: true,
      governorEnabled: true,
      maxRevisions: 1,
      revisionScoreThreshold: 6
    }
  });
}