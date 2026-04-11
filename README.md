# Smart Token

> *Don't change human behavior, optimize what happens underneath.*

People talk to AI like they talk to people — polite, rambling, full of filler. That's natural. But every word costs tokens. Smart Token compresses what you send without changing how you write.

**Be yourself. I'll handle the cost.**

## Who is this for

- **AI wrapper products** proxying thousands of user requests — 26% off your API bill, one line of config
- **Agent-heavy workflows** with long system prompts, tool definitions, and 30+ turn histories
- **Cost-sensitive developers** who don't want to rewrite their prompts to save tokens

Two commands. No behavior change. No instructions injected into your API calls — all compression happens locally before the request leaves your machine.

```bash
bun add -g smart-token && smart-token start
```

## Getting Started

```bash
bun add smart-token        # as a library
bun add -g smart-token     # as a CLI tool
```

Requires [Bun](https://bun.sh).

### Development

```bash
bun install        # install deps
bun test           # run 156 tests
bun run lint       # lint
bun run sharpen    # run CLI
bun run src/proxy/server.ts   # start proxy directly
```

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
// What actually gets sent: "fix this bug?"

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
// result.compressed: "fix this bug"
// result.stats: { saved: 9, savingsPercent: "56.3%" }
```

## What Gets Trimmed

Five compression layers, each targeting a different part of the API request:

| Layer | Target | Typical savings |
|-------|--------|----------------|
| 1. Messages | User messages | ~20-60% |
| 2. Code blocks | Code, logs, build output | ~50-70% on logs |
| 3. Media & files | Embedded data (CSV, JSON, XML, HTML) | Varies by format |
| 4. System prompt | System instructions | ~10-30% |
| 5. History | Conversation history | Biggest at scale |

A **verification pass** runs after every compression — if meaning degrades, it falls back to the original.

---

### Layer 1 — Message Compression

User messages get trimmed using three tiers. Each tier includes everything from the tier above it.

#### Tier A — Safe (always removable)

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

#### Tier B — Moderate (default)

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

#### Tier C — Aggressive

Structural words that can be inferred from context:

| Category | What gets removed | Example |
|----------|------------------|---------|
| Articles | a, an, the | *the* function returns *a* list → function returns list |
| Linking verbs | is, are, was, were | This *is* broken → This broken |
| Vague quantifiers | very, really, quite, pretty much, rather | *very* slow → slow |
| Demonstratives | "this" (when not comparing) | *this* code fails → code fails |
| Prepositions | that, for, in the, of the | Check *that* it works → Check it works |

#### Chinese Language Support

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

#### Tone & Intent Detection

Layer 1 detects the tone and intent of your message for analytics and logging:

Detected tones: `polite`, `uncertain`, `frustrated`, `exploring`, `urgent`, `neutral`
Detected intents: `confirm`, `compare`, `explain`, `fix`, `build`, `review`, `explore`

Tone data is available in the stats object but is **not injected into the request**. Smart Token only removes content — it never adds tags, prefixes, or metadata to what gets sent to the API.

#### What's Never Touched

No matter the tier, Smart Token preserves:

- **Code blocks** — everything inside ``` fences is untouched
- **Constraints** — "must", "only", "don't", "never", "always"
- **Preferences** — "I prefer X over Y"
- **Conditionals** — "if X then Y", "unless"
- **Comparisons** — "this vs that", "compared to"
- **Context that matters** — file paths, error messages, variable names, URLs

---

### Layer 2 — Code Block Compression

Code pasted in prompts often has noise the AI doesn't need to read:

- **Comment stripping** — removes single-line, block, copyright headers, TODO comments, and commented-out code (supports 17 languages)
- **Language-aware whitespace** — normalizes indentation but preserves it for Python, YAML, Makefile, and Haskell
- **Log compression** — collapses timestamps, thread IDs, repeated lines, and shortens file paths. 200 lines of logs → errors + collapsed repeats
- **Test output compression** — strips passing tests, keeps only failures
- **Build output compression** — strips progress bars and step-by-step lines, keeps errors and warnings
- **Terminal noise** — removes ANSI color codes, shell prompts
- **Repetitive code detection** — 3+ similar functions get collapsed to pattern + count

---

### Layer 3 — Media & File Compression

When users paste data into prompts, it's usually way more than the AI needs:

- **CSV** — 1000-row CSV becomes: schema + first 10 rows + column stats (min/max/avg or unique count)
- **JSON** — large arrays of same-structure objects become: schema + 3 examples + count. Nested objects get depth-limited
- **XML/HTML** — strips comments, collapses whitespace, removes redundant attributes
- **Markdown** — cleans up formatting noise while preserving structure

---

### Layer 4 — System Prompt Compression

System prompts are often the largest token cost and they repeat every single request. Layer 4 optimizes them:

- **Section classification** — identifies static (role, rules), semi-static (tools, context), and dynamic (current date, session) sections
- **Cache-friendly reordering** — puts static content first so API-level prompt caching hits more often
- **Negative instruction dedup** — "don't do X", "never do X", "avoid X" about the same thing → keeps only the most specific version
- **Rule example collapsing** — if a rule is clear on its own, verbose examples get dropped
- **Section deduplication** — detects >70% overlap between sections and removes duplicates
- **Relevance filtering** — optionally strips sections unrelated to the current message context

---

### Layer 5 — History Compression

Long conversations accumulate messages the AI doesn't need in full. Layer 5 manages this with:

- **Sliding window** — keeps the most recent messages (default 10) in full
- **Breathing archive** — older messages get summarized into compact topic-tagged summaries
- **Decision preservation** — constraints, preferences, and decisions ("we're using X not Y") are never summarized away
- **Failed attempt collapsing** — "try X → didn't work → try Y → worked" sequences collapse to just the working solution
- **Acknowledgment compression** — verbose "thank you so much!" becomes "thanks", while grounding signals ("got it", "makes sense") stay

## Examples

```
"Hey Claude! I was wondering if you could please help me fix this bug? 😊"
→ fix this bug?                                                    (61% saved)

"Hmm, let me think... I guess what I really want is a sorted list"
→ a sorted list                                                    (61% saved)

"Thank you so much that was really helpful!"
→ thanks                                                           (93% saved)

"然后就是说那个代码有问题吧"
→ 代码有问题                                                        (62% saved)

[200 lines of logs with timestamps, thread IDs, repeated entries]
→ [12 lines: errors + collapsed repeats]                           (72% saved)
```

## Benchmarks

Real-world use cases, tested with `bun benchmarks/run.ts`:

| Use Case | Messages | Savings | Main layers |
|----------|----------|---------|-------------|
| Data analysis (CSV/JSON in prompts) | 5 | **67%** | Media compression |
| Code assistant (React debugging) | 8 | **62%** | Code + message compression |
| Long dev session (2hr, auth+db) | 55 | **61%** | History + code compression |
| Customer support chatbot | 31 | **47%** | History compression |
| Multilingual (English + Chinese) | 9 | **38%** | Message + code compression |
| Agent workflow (Claude Code-style) | 7 | **1%** | System prompt dedup |

Savings vary by content type. Code blocks, pasted data, and long conversation histories save the most. Pre-optimized system prompts (like Claude Code's) save the least — there's nothing to trim.

Run the demo: `bun demo.ts`

## Providers

Works with any LLM API:

- **Anthropic** (Claude) — native support
- **OpenAI** (GPT) — native support
- **Google** (Gemini) — native support
- **Any OpenAI-compatible API** — Mistral, DeepSeek, local models, etc.

## License

MIT
