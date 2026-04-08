# Smart Token

> *Don't change human behavior, optimize what happens underneath.*

People talk to AI like they talk to people — polite, rambling, full of filler. That's natural. But every word costs tokens. Smart Token compresses what you send without changing how you write.

**Be yourself. I'll handle the cost.**

## Install

```bash
bun add smart-token
```

## SDK Wrapper

Drop in, compression happens automatically.

```typescript
import { createOptimizedClient } from "smart-token";

const client = createOptimizedClient({
  provider: "anthropic",  // also: "openai", "google", "generic"
  apiKey: process.env.ANTHROPIC_API_KEY,
  compression: { tier: "B" },  // A = safe, B = moderate, C = aggressive
});

// Use exactly like the native SDK
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hey Claude! Can you please help me fix this bug? Thanks! 😊" }],
});
// What actually gets sent: "[polite, fix] fix this bug?"

const stats = await client.cleanup();
// { totalTokensSaved: 12847, savingsPercent: "58%", estimatedCostSaved: "$0.38" }
```

## CLI

```bash
# Compress a prompt file (Layer 1 + Layer 4)
npx smart-token sharpen ./system-prompt.txt

# Compress a folder
npx smart-token sharpen ./prompts/

# Watch mode
npx smart-token sharpen ./system-prompt.txt --watch

# View savings dashboard
npx smart-token stats ./token-savings.json
```

## Direct API

```typescript
import { compress, compressMessage } from "smart-token";

const result = compress("Hey Claude! Please fix this bug 😊");
// result.compressed: "[polite, fix] fix this bug"
// result.stats: { saved: 7, savingsPercent: "46.7%" }

const { compressed } = compressMessage("Thanks so much!!", "A");
// "thanks"
```

## How It Works

Five compression layers run in order, biggest savings first:

| Layer | What it does | Example savings |
|-------|-------------|----------------|
| 5. History | Sliding window + breathing archive for old messages | Biggest at scale |
| 4. System prompt | Trim + deduplicate + auto-cache structuring | ~10-30% |
| 3. Media & files | CSV, JSON, XML, HTML compression | Varies |
| 2. Code blocks | Strip comments, logs, whitespace, IDE boilerplate | ~50-70% on logs |
| 1. Messages | Strip filler, greetings, emojis, hedging | ~20-60% |

A **verification pass** after compression catches accidental context loss — if meaning degrades, it falls back to the original.

## Compression Tiers

**A (safe)** — emojis, greetings, filler words, apologies, reaction words

**B (default)** — A + pronouns, hedging, narrating, redundancy, over-explanation

**C (aggressive)** — A+B + articles, linking verbs, quantifiers, prepositions

### Never touched
Constraints, context, preferences, code blocks, conditionals, comparisons.

## Examples

```
"Hey Claude! I was wondering if you could please help me fix this bug? 😊"
→ [polite, fix] fix this bug?                                      (61% saved)

"Hmm, let me think... I guess what I really want is a sorted list"
→ [uncertain] a sorted list                                        (61% saved)

"Thank you so much that was really helpful!"
→ thanks                                                           (93% saved)

"然后就是说那个代码有问题吧"
→ 代码有问题                                                        (62% saved)

[200 lines of logs with timestamps, thread IDs, repeated entries]
→ [12 lines: errors + collapsed repeats]                           (72% saved)
```

## Language Support

English (full), Chinese (particles, filler, politeness), bilingual auto-detection.

## Development

```bash
bun install        # install deps
bun test           # run 156 tests
bun run lint       # lint
bun run sharpen    # run CLI
```

## Publish to npm

```bash
npm login                # one-time setup
npm publish --dry-run    # preview what gets published
npm publish              # publish for real
```

After publishing, anyone can use:
```bash
bun add smart-token                        # as a library
npx smart-token sharpen ./prompt.txt       # as a CLI tool
```

**Note:** Smart Token uses Bun APIs, so users need [Bun](https://bun.sh) installed.

## License

MIT
