// Configuration system — central system configuration.
// LLM calls route through Base44's built-in InvokeLLM integration (platform-managed
// key), so no external API key or credits are required. Model names are InvokeLLM IDs.

export function getSystemConfig() {
  return Object.freeze({
    orchestrator: {
      maxHistoryMessages: 20,
      maxMemories: 10,
      memoryPoolSize: 20
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