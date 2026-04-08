interface OpenAIAdapter {
  send(params: Record<string, unknown>): Promise<unknown>;
}

export function createOpenAIAdapter(apiKey: string): OpenAIAdapter {
  let client: { chat: { completions: { create: (params: unknown) => Promise<unknown> } } } | null = null;

  async function getClient() {
    if (!client) {
      try {
        const OpenAI = (await import("openai")).default;
        client = new OpenAI({ apiKey }) as typeof client;
      } catch {
        throw new Error(
          "Missing openai SDK. Install it: bun add openai"
        );
      }
    }
    return client;
  }

  return {
    async send(params: Record<string, unknown>): Promise<unknown> {
      const openai = await getClient();
      // Map from our format to OpenAI format
      const mapped = {
        model: params.model ?? "gpt-4o",
        messages: params.messages,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        ...params,
      };
      return openai.chat.completions.create(mapped);
    },
  };
}
