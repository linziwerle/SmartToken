interface GoogleAdapter {
  send(params: Record<string, unknown>): Promise<unknown>;
}

export function createGoogleAdapter(apiKey: string): GoogleAdapter {
  let model: { generateContent: (params: unknown) => Promise<unknown> } | null = null;

  async function getModel(modelName = "gemini-2.0-flash") {
    if (!model) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: modelName });
      } catch {
        throw new Error(
          "Missing @google/generative-ai SDK. Install it: bun add @google/generative-ai"
        );
      }
    }
    return model;
  }

  return {
    async send(params: Record<string, unknown>): Promise<unknown> {
      const gemini = await getModel(params.model as string | undefined);
      // Map from our message format to Gemini format
      const messages = params.messages as
        | Array<{ role: string; content: string }>
        | undefined;

      if (messages && messages.length > 0) {
        // Gemini uses a different format: parts array
        const lastMessage = messages[messages.length - 1]!;
        const history = messages.slice(0, -1).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        // For simple single-turn, just send the content
        if (history.length === 0) {
          return gemini.generateContent(lastMessage.content);
        }

        // Multi-turn: use startChat
        return gemini.generateContent({
          contents: [
            ...history,
            {
              role: "user",
              parts: [{ text: lastMessage.content }],
            },
          ],
        });
      }

      return gemini.generateContent(params);
    },
  };
}
