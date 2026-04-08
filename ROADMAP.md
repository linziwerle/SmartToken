# Smart Token — Roadmap & UX

*Companion to `token-optimizer-architecture.md`. Captures integration strategy, UX decisions, and what's next.*

---

## CLI Display Modes (shipped 2026-04-07)

The `sharpen` CLI now supports three modes. Developers want control over what they see.

```bash
bun run sharpen <file>         # default — stats + compressed output
bun run sharpen <file> --quiet # stats only, no output
bun run sharpen <file> --dev   # stats + original with trimmed words highlighted
```

### Why `--dev` instead of `--diff`

Developers don't think "show me a diff" — they think "show me what's happening under the hood." Dev mode shows the original text with removed words in red strikethrough. You see what you wrote, with the trimmed parts visually crossed out.

This matters because **developers hate auto-delete.** They want transparency. If they can see what's being removed and why, they trust the tool. If it's a black box, they don't.

### Implementation

Word-level diff using longest common subsequence (LCS) between original and compressed output. No hooks into individual rules — just compares input vs output. Clean and decoupled from the engine.

All three modes work with `--watch`, `--tier`, single files, and folders.

---

## Integration Strategy

The CLI is a demo tool. The real value is **invisible compression** — you type naturally, savings happen automatically.

### Why not hooks?

We investigated CLI hooks (Claude Code `UserPromptSubmit`, etc.) first. The problem: **hooks can't modify message content.** They can inject context or block messages, but can't rewrite what's sent to the API. Same limitation across most AI tools — they own the pipeline.

### The answer: local proxy

SmartToken runs as a lightweight local proxy. AI tools think they're talking to the real API — SmartToken compresses in the middle.

```
You type naturally in Claude Code (or any AI tool)
      ↓
Claude Code sends to ANTHROPIC_BASE_URL (localhost:3141)
      ↓
SmartToken receives, compresses (~1ms)
      ↓
Forwards to real api.anthropic.com
      ↓
Response comes back untouched
```

**Why this works:** Most AI tools support custom base URLs via environment variables. One env var change routes all traffic through SmartToken.

### Install experience

```bash
# Install (one time)
brew install smart-token
# or
npm install -g smart-token

# Auto-starts via launchd — runs in background like Spotlight.
# No "remember to start it." Install and forget.
```

**Setup (one time, in .zprofile):**
```bash
export ANTHROPIC_BASE_URL=http://localhost:3141
export OPENAI_BASE_URL=http://localhost:3141/openai
```

**Mode switching:**
```bash
smart-token mode dev     # see what's trimmed
smart-token mode quiet   # silent compression
smart-token mode off     # passthrough, no compression
smart-token status       # show current mode + session stats
```

### What the proxy handles

| Layer | What it compresses |
|-------|--------------------|
| Layer 1 | User messages — filler, greetings, hedging |
| Layer 2 | Code blocks — comments, logs, whitespace |
| Layer 3 | Media & files — CSV, JSON, XML, HTML |
| Layer 4 | System prompts — trim + auto-cache structuring |
| Layer 5 | History — sliding window, archive old messages |

All 5 layers of the existing engine, applied to the full API request. Same engine, new entry point.

### Tools supported (via base URL override)

Any tool that supports a custom API base URL works automatically:

| Tool | Environment variable |
|------|---------------------|
| **Claude Code** | `ANTHROPIC_BASE_URL` |
| **GitHub Copilot CLI** | `OPENAI_BASE_URL` |
| **Aider** | `ANTHROPIC_BASE_URL` or `OPENAI_BASE_URL` |
| **Cursor** | Settings → API base URL |
| **Continue.dev** | Config → apiBase |
| **Cline** | Settings → base URL |
| **Open Interpreter** | `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` |
| **Goose** | Config → base URL |
| **Windsurf** | Settings → API endpoint |
| **Any OpenAI-compatible tool** | `OPENAI_BASE_URL` |

One proxy, all tools. No per-tool integration needed.

### SDK wrapper (already built, separate use case)

For developers building their own AI apps:

| Tool | Integration | How |
|------|------------|-----|
| **Any Anthropic SDK app** | `createOptimizedClient()` | Already built |
| **Any OpenAI SDK app** | Same wrapper pattern | Already built |
| **Any Google SDK app** | Same wrapper pattern | Already built |
| **Any OpenAI-compatible API** | Generic adapter | Already built |

SDK users get compression without the proxy — it's baked into their code.

### Mode switching in hooks

Users need to swap modes easily without editing config files:

```
Modes:
  off      — passthrough, no compression
  quiet    — compress silently, no output
  default  — compress + show stats after each message
  dev      — compress + show what was trimmed
```

How to switch (design options, TBD):
- **Environment variable:** `SMART_TOKEN_MODE=dev` — simple, works everywhere
- **CLI command:** `smart-token mode dev` — writes to a state file the hook reads
- **In-session command:** type `/smart-token dev` in Claude Code — hook intercepts and switches

Environment variable is the simplest starting point. The hook reads `SMART_TOKEN_MODE` on each invocation. Change it, next message uses the new mode. No restart needed.

### Rollout order

1. **Local proxy** — build `smart-token start` with Bun.serve(). Test with Claude Code first.
2. **launchd integration** — auto-start on login, so users never think about it.
3. **Mode switching CLI** — `smart-token mode dev|quiet|off`, `smart-token status`.
4. **Homebrew formula** — `brew install smart-token` for zero-friction install.
5. **SDK wrapper** — already done. Separate use case for app developers.
6. **CLI `sharpen`** — already done. Demo/testing/prompt optimization tool.

---

## What's Built (as of 2026-04-07)

| Component | Status | Notes |
|-----------|--------|-------|
| 5-layer compression engine | Done | 6,100 LOC, all layers working |
| CLI `sharpen` command | Done | `--dev`, `--quiet`, `--watch`, `--tier`, folder batch |
| CLI `stats` dashboard | Done | Historical savings view |
| SDK `createOptimizedClient()` | Done | Anthropic, OpenAI, Google, Generic adapters |
| Token counter + cost estimation | Done | Per-message and session stats |
| Post-compression verification | Done | Content word survival check |
| English rules (3 tiers) | Done | A/B/C with tone+intent detection |
| Chinese rules | Done | Particles, politeness, filler |
| Test suite | Done | 152 passing (4 CLI PATH failures, not engine) |

## What's Next

| Priority | Item | Effort |
|----------|------|--------|
| 1 | **Local proxy server** (`smart-token start`) | Medium — Bun.serve() + request forwarding |
| 2 | **Mode switching** (`smart-token mode dev\|quiet\|off`) | Small — state file + proxy reads it |
| 3 | **launchd plist** — auto-start on login | Small — plist + install script |
| 4 | **Homebrew formula** | Medium — tap setup + binary build |
| 5 | Fix `\!` escaping bug in CLI output | Small |
| 6 | Fix CLI test PATH issue (Bun.spawn) | Small |
| 7 | Additional language rules (es, ja) | Medium per language |
| 8 | v2 embedding validation (cosine similarity) | Large |
