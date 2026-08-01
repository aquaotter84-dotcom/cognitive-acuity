// Council operator — Web Search tool. Pulls current information from the web into
// the council's reasoning when the Observer flags the query as needing real-time
// facts (or the user forces it via the web-search toggle). Returns a sourced
// factual briefing that is surfaced in the council trace and fed to the Specialist
// as explicit context — so the council reasons over pulled facts, not opaque
// model-internal grounding. Degrades gracefully: on failure, passes through.

import { defineAgent } from "../runtime.ts";
import { callLLM } from "../llm.ts";

// Only Gemini models support add_context_from_internet (live web access).
const SEARCH_MODEL = "gemini_3_flash";

export const webSearchAgent = defineAgent({
  name: "webSearch",
  type: "stage",
  async handle(message, ctx) {
    const content = message.content;
    const classification = content.classification;
    const forced = !!content.webSearch;
    const needed = !!(classification && classification.needs_web_search);
    if (!forced && !needed) {
      return { ...content };
    }
    const query = (classification && classification.search_query && String(classification.search_query).trim()) || content.userMessage;
    try {
      const briefing = await callLLM(ctx, {
        model: SEARCH_MODEL,
        add_context_from_internet: true,
        messages: [
          {
            role: "system",
            content: "You are the COGNOS Web Search tool. Using real-time web access, answer the search query with a concise factual briefing of the most current, specific information (dates, numbers, names, events). Cite sources as a bulleted list of URLs or source names at the end. If current information is unavailable, say so briefly. Keep it tight — this is reference material for the council to reason over, not the final answer."
          },
          { role: "user", content: `Search query: ${query}` }
        ]
      });
      const results = typeof briefing === "string" ? briefing.trim() : "";
      if (!results) return { ...content };
      return { ...content, searchQuery: query, searchResults: results, webSearchModel: SEARCH_MODEL };
    } catch (e) {
      ctx.logger.warn("web search failed", { error: String(e) });
      return { ...content };
    }
  }
});