interface AnthropicAdapter {
  send(params: Record<string, unknown>): Promise<unknown>;
}

export function createAnthropicAdapter(apiKey: string): AnthropicAdapter {
  // Lazy import to avoid requiring the SDK if not using Anthropic
  let client: { messages: { create: (params: unknown) => Promise<unknown> } } | null = null;

  async function getClient() {
    if (!client) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        client = new Anthropic({ apiKey });
      } catch {
        throw new Error(
          "Missing @anthropic-ai/sdk. Install it: bun add @anthropic-ai/sdk"
        );
      }
    }
    return client;
  }

  return {
    async send(params: Record<string, unknown>): Promise<unknown> {
      const anthropic = await getClient();

      // Inject cache_control into system prompt if breakpoints are provided
      const cacheBreakpoints = params._cacheBreakpoints as
        | Array<{ position: number; type: string; section: string }>
        | undefined;

      if (cacheBreakpoints && cacheBreakpoints.length > 0 && params.system) {
        const systemText = params.system as string;
        // Split system prompt at breakpoints into content blocks with cache_control
        const blocks: Array<{ type: string; text: string; cache_control?: { type: string } }> = [];
        let lastPos = 0;

        for (const bp of cacheBreakpoints) {
          const chunk = systemText.slice(lastPos, bp.position);
          if (chunk.trim().length > 0) {
            blocks.push({
              type: "text",
              text: chunk,
              cache_control: { type: bp.type },
            });
          }
          lastPos = bp.position;
        }

        // Remaining text after last breakpoint (dynamic section, no cache)
        const remaining = systemText.slice(lastPos);
        if (remaining.trim().length > 0) {
          blocks.push({ type: "text", text: remaining });
        }

        // Use block format for system prompt
        const { _cacheBreakpoints: _, system: __, ...rest } = params;
        return anthropic.messages.create({ ...rest, system: blocks });
      }

      // Strip internal fields before sending
      const { _cacheBreakpoints: _, ...cleanParams } = params;
      return anthropic.messages.create(cleanParams);
    },
  };
}
