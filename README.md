# Smart Token

> *Don't change human behavior, optimize what happens underneath.*

People talk to AI like they talk to people — polite, rambling, full of filler. That's natural. But every word costs tokens. Smart Token compresses what you send without changing how you write.

**Be yourself. I'll handle the cost.**

## How to Use

There are three ways to use Smart Token, from easiest to most flexible:

### 1. Local Proxy (recommended)

A local proxy that compresses API requests on the fly. Point your SDK at `localhost:3141` — no code changes needed.

```bash
bun add -g smart-token

# Start the proxy
smart-token start           # foreground
smart-token start -d        # daemon (background)
```

Route your API calls through it:

```bash
export ANTHROPIC_BASE_URL=http://localhost:3141
export OPENAI_BASE_URL=http://localhost:3141/openai
```

That's it. Every API call now gets compressed automatically.

```bash
# Check what's happening
smart-token status

# Switch display modes (hot-reloads, no restart needed)
smart-token mode quiet      # compress silently, log to file
smart-token mode default    # one-line stats per request
smart-token mode dev        # show what was trimmed (strikethrough diff)
smart-token mode off        # passthrough, no compression

# View recent request logs
smart-token logs

# Stop (prints a session report with savings summary)
smart-token stop

# Auto-start on login (macOS)
smart-token install
```

### 2. SDK Wrapper

Drop-in replacement for your API client. Compression happens automatically.

```typescript
import { createOptimizedClient } from "smart-token";

const client = createOptimizedClient({
  provider: "anthropic",  // also: "openai", "google", "generic"
  apiKey: process.env.ANTHROPIC_API_KEY,
  compression: { tier: "B" },
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

### 3. CLI (for prompt files)

Compress prompt files before deploying them.

```bash
npx smart-token sharpen ./system-prompt.txt       # compress a file
npx smart-token sharpen ./prompts/                 # compress a folder
npx smart-token sharpen ./prompt.txt --watch       # watch for changes
npx smart-token sharpen ./prompt.txt --dev         # see what was trimmed
npx smart-token stats ./token-savings.json         # savings dashboard
```

### 4. Direct API

```typescript
import { compress, compressMessage } from "smart-token";

const result = compress("Hey Claude! Please fix this bug 😊");
// result.compressed: "[polite, fix] fix this bug"
// result.stats: { saved: 7, savingsPercent: "46.7%" }
```

## What Gets Trimmed

Smart Token uses three compression tiers. Each tier includes everything from the tier above it.

### Tier A — Safe (always removable)

Things that carry zero information for the AI:

| Category | What gets removed | Example |
|----------|------------------|---------|
| Emojis | All emoji characters | 😊 🎉 👍 → *(removed)* |
| Greetings | "Hey Claude", "Hi there", "Hello" | *Hey Claude!* Can you... → Can you... |
| Reaction words | lol, haha, omg, rofl | That's great lol → That's great |
| Filler sounds | hmm, umm, uh | *Hmm,* I think... → I think... |
| Filler words | basically, actually, just, like, you know, well, I mean, kind of | It's *basically just* a loop → It's a loop |
| Pleasantries | "Hope you're doing well", "Hope this helps" | *(removed)* |
| Verbose thanks | "Thank you so much for your help!" | → thanks |
| Trailing thanks | "Thanks!" at end of message | *(removed)* |
| Apologies | "Sorry to bother you", "I know this is basic but" | *(removed)* |
| Stalling ellipsis | Trailing "..." | I was thinking... → I was thinking |
| Extra punctuation | Multiple ??? or !!! | What???? → What? |
| Extra whitespace | Blank lines, trailing spaces | *(collapsed)* |
| Markdown in chat | Bold/italic in casual messages | \*\*this\*\* → this |
| Encoding garbage | Mojibake from copy-paste | *(cleaned)* |

### Tier B — Moderate (default)

Conversational padding that humans use but AI doesn't need:

| Category | What gets removed | Example |
|----------|------------------|---------|
| Polite requests | "Can you please", "Could you maybe", "Would it be possible to" | *Can you please* fix → fix |
| Wondering | "I was wondering if" | *I was wondering if* this works → this works |
| Help framing | "Help me to", "Assist me" | *Help me* understand → understand |
| Please | Standalone "please" | *Please* check this → check this |
| Thinking out loud | "Let me think", "I guess what I really want is" | *Let me think...* a sorted list → a sorted list |
| Pronoun framing | "I wrote this function and want you to" | *I wrote this* function *and want you to* check → function — check |
| Narrating | "I'm going to paste my code below", "Here's my error" | *(removed)* |
| Over-explanation | "cleaner and more readable and easier to maintain" | → cleaner, readable |
| Permission asking | "Is it okay if I", "Do you mind if I" | *(removed)* |
| Softening | "This might be a dumb question but" | *(removed)* |
| Hedging | "Do you think maybe I should", "I'm not sure if" | *(removed)* |
| Validation seeking | "Does that make sense?", "Know what I mean?" | *(removed)* |
| Context preamble | "I've been working on this for hours and" | *(removed)* |

### Tier C — Aggressive

Structural words that can be inferred from context:

| Category | What gets removed | Example |
|----------|------------------|---------|
| Articles | a, an, the | *the* function returns *a* list → function returns list |
| Linking verbs | is, are, was, were | This *is* broken → This broken |
| Vague quantifiers | very, really, quite, pretty much, rather | *very* slow → slow |
| Demonstratives | "this" (when not comparing) | *this* code fails → code fails |
| Prepositions | that, for, in the, of the | Check *that* it works → Check it works |

### Chinese Language Support

The same tier system applies to Chinese text (auto-detected):

| Tier | What gets removed | Example |
|------|------------------|---------|
| A | Sentence-final particles (啊、呢、吧、嘛、啦、咯) | 代码有问题*吧* → 代码有问题 |
| A | Filler words (然后、就是说、那个、这个、好像) | *然后就是说那个*代码有问题 → 代码有问题 |
| A | Reaction words (哈哈、呵呵、嘿嘿) | *(removed)* |
| B | Politeness (请问、麻烦你、不好意思、请帮我) | *请帮我*看一下 → 看一下 |
| B | Hedging (我想、我觉得) | *我觉得*这里有问题 → 这里有问题 |
| B | Verbose thanks (非常感谢、太感谢了) | → 谢谢 |
| C | Demonstratives (这个、那个 before nouns) | *这个*代码 → 代码 |
| C | Filler measure words (一下) | 看*一下* → 看 |

### What's Never Touched

No matter the tier, Smart Token preserves:

- **Code blocks** — everything inside ``` fences is untouched
- **Constraints** — "must", "only", "don't", "never", "always"
- **Preferences** — "I prefer X over Y"
- **Conditionals** — "if X then Y", "unless"
- **Comparisons** — "this vs that", "compared to"
- **Context that matters** — file paths, error messages, variable names, URLs

## How It Works

Five compression layers run in order, biggest savings first:

| Layer | What it does | Typical savings |
|-------|-------------|----------------|
| 5. History | Sliding window + breathing archive for old messages | Biggest at scale |
| 4. System prompt | Trim + deduplicate + section classification for caching | ~10-30% |
| 3. Media & files | CSV, JSON, XML, HTML, Markdown compression | Varies by format |
| 2. Code blocks | Strip comments, logs, whitespace, IDE boilerplate | ~50-70% on logs |
| 1. Messages | Apply tier rules (tables above) + tone/intent tagging | ~20-60% |

A **verification pass** runs after compression — if meaning degrades, it falls back to the original.

### Tone & Intent Detection

Layer 1 detects the tone and intent of your message and prepends a compact tag:

```
"Hey Claude! I was wondering if you could please help me fix this bug? 😊"
→ [polite, fix] fix this bug?
```

Detected tones: `polite`, `uncertain`, `frustrated`, `exploring`, `urgent`, `neutral`
Detected intents: `confirm`, `compare`, `explain`, `fix`, `build`, `review`, `explore`

The AI still knows *how* you were asking — it's just encoded in 2 words instead of 15.

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

## Providers

Works with any LLM API:

- **Anthropic** (Claude) — native support
- **OpenAI** (GPT) — native support
- **Google** (Gemini) — native support
- **Any OpenAI-compatible API** — Mistral, DeepSeek, local models, etc.

## Install

```bash
bun add smart-token        # as a library
bun add -g smart-token     # as a CLI tool
```

Requires [Bun](https://bun.sh).

## Development

```bash
bun install        # install deps
bun test           # run 156 tests
bun run lint       # lint
bun run sharpen    # run CLI
bun run src/proxy/server.ts   # start proxy directly
```

## License

MIT
