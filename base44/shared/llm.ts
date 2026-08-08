// Shared LLM utilities — routes model calls through Base44's built-in InvokeLLM
// integration (platform-managed key), so the app needs no external API key or credits.
// Used by the council operators and the memory stage.
//
// InvokeLLM takes a single prompt string (not a message array), so chat messages are
// flattened. When responseJsonSchema is provided, InvokeLLM returns a parsed object;
// otherwise it returns a string.

import { withCharter } from "./council/charter.ts";

export async function callLLM(
    ctx,
      {
          messages,
              responseJsonSchema = null,
                  model = null,
                      file_urls = null,
                          add_context_from_internet = null
                            }
                            ) {
                              const apiKey = secrets.BLUESMINDS_API_KEY;
                                const apiUrl =
                                    secrets.BLUESMINDS_API_URL ||
                                        "https://api.bluesminds.com/v1/chat/completions";
                                          const selectedModel =
                                              model ||
                                                  secrets.BLUESMINDS_MODEL;

                                                    if (!apiKey) {
                                                        throw new Error("BLUESMINDS_API_KEY is not configured");
                                                          }

                                                            if (!selectedModel) {
                                                                throw new Error("BLUESMINDS_MODEL is not configured");
                                                                  }

                                                                    const payload = {
                                                                        model: selectedModel,
                                                                            messages,
                                                                                ...(responseJsonSchema
                                                                                      ? {
                                                                                                response_format: {
                                                                                                            type: "json_schema",
                                                                                                                        json_schema: responseJsonSchema
                                                                                                                                  }
                                                                                                                                          }
                                                                                                                                                : {}),
                                                                                                                                                  };

                                                                                                                                                    const response = await fetch(apiUrl, {
                                                                                                                                                        method: "POST",
                                                                                                                                                            headers: {
                                                                                                                                                                  "Authorization": `Bearer ${apiKey}`,
                                                                                                                                                                        "Content-Type": "application/json"
                                                                                                                                                                            },
                                                                                                                                                                                body: JSON.stringify(payload)
                                                                                                                                                                                  });

                                                                                                                                                                                    const text = await response.text();

                                                                                                                                                                                      let data;
                                                                                                                                                                                        try {
                                                                                                                                                                                            data = JSON.parse(text);
                                                                                                                                                                                              } catch {
                                                                                                                                                                                                  throw new Error(
                                                                                                                                                                                                        `BluesMinds returned invalid JSON (${response.status})`
                                                                                                                                                                                                            );
                                                                                                                                                                                                              }

                                                                                                                                                                                                                if (!response.ok) {
                                                                                                                                                                                                                    throw new Error(
                                                                                                                                                                                                                          `BluesMinds request failed (${response.status}): ${
                                                                                                                                                                                                                                  data?.error?.message ||
                                                                                                                                                                                                                                          data?.error ||
                                                                                                                                                                                                                                                  "Unknown error"
                                                                                                                                                                                                                                                        }`
                                                                                                                                                                                                                                                            );
                                                                                                                                                                                                                                                              }

                                                                                                                                                                                                                                                                if (responseJsonSchema) {
                                                                                                                                                                                                                                                                    const content = data?.choices?.[0]?.message?.content;

                                                                                                                                                                                                                                                                        if (typeof content === "string") {
                                                                                                                                                                                                                                                                              try {
                                                                                                                                                                                                                                                                                      return JSON.parse(content);
                                                                                                                                                                                                                                                                                            } catch {
                                                                                                                                                                                                                                                                                                    throw new Error(
                                                                                                                                                                                                                                                                                                              "BluesMinds returned JSON-schema content that could not be parsed"
                                                                                                                                                                                                                                                                                                                      );
                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                                                                                                                    return content;
                                                                                                                                                                                                                                                                                                                                      }

                                                                                                                                                                                                                                                                                                                                        return data?.choices?.[0]?.message?.content ?? "";
                                                                                                                                                                                                                                                                                                                                        }
)