interface GenericAdapter {
  send(params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generic adapter for OpenAI-compatible APIs.
 * Works with: local models (Ollama, LM Studio), Groq, Together, DeepSeek, etc.
 */
export function createGenericAdapter(
  apiKey: string,
  baseUrl = "http://localhost:11434/v1"
): GenericAdapter {
  return {
    async send(params: Record<string, unknown>): Promise<unknown> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: params.model ?? "default",
          messages: params.messages,
          max_tokens: params.max_tokens,
          temperature: params.temperature,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Generic API error (${response.status}): ${error}`);
      }

      return response.json();
    },
  };
}
