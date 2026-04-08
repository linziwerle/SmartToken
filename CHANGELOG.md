# Changelog

## 1.0.0

### Layer 1 — Message Compressor
- Tiered compression: A (safe), B (moderate), C (aggressive)
- Tone detection: polite, uncertain, frustrated, exploring, urgent, neutral
- Intent detection: confirm, compare, explain, fix, build, review, explore
- Self-correction handling (simple flip vs exploration)
- Acknowledgment handling (verbose thanks → "thanks", grounding signals preserved)
- Redundancy detection (ask-then-reask, summarize preamble, word overlap)
- Thinking out loud stripping ("Hmm, let me think...")
- Over-explanation compression ("cleaner and more readable and easier to maintain" → "cleaner, readable")
- Pronoun framing ("I wrote this function and want you to check it" → "function — check it")
- Chinese language support (particles, filler, politeness prefixes)
- Bilingual mode (mixed English + Chinese)
- Code block protection (never modifies content inside ```)

### Layer 2 — Code Block Compressor
- Language detection (17 languages via fence labels + syntax patterns)
- Comment stripping (single-line, block, copyright, TODO, commented-out code)
- Language-aware whitespace normalization (preserves Python/YAML indentation)
- Log compression (timestamps, thread IDs, repeated lines, file path shortening)
- Test output compression (strips passing tests, keeps failures)
- Build output compression (strips progress lines, keeps errors)
- Terminal noise removal (ANSI codes, shell prompts)
- Repetitive code detection (3+ similar functions → pattern + count)
- IDE-generated file detection and compression

### Layer 3 — Media & File Compressor
- CSV truncation (>50 rows → schema + 10 rows + stats)
- JSON minification + large array schema compression
- XML cleanup (namespace dedup, auto-generated IDs, DTD, CDATA)
- HTML stripping (script/style, Tailwind class compression, inline SVG)
- Markdown cleanup (embedded HTML, link references)
- Auto content type detection

### Layer 4 — System Prompt Compressor
- Layer 1 trimming applied to prompt text
- Negative instruction deduplication
- Rule/example collapsing
- Section relevance filtering
- Cache structure optimization (static → semi-static → dynamic)
- Section deduplication

### Layer 5 — History Compressor
- Sliding window (configurable, default 10 messages)
- Decision/constraint preservation (never compressed)
- Acknowledgment compression (verbose → minimal, grounding signals kept)
- Failed attempt detection (keep only working solution)
- Superseded code detection (drop old versions)
- AI response summarization
- Repeated context deduplication
- Breathing archive (cold storage on disk, targeted retrieval)
- Session cleanup (privacy — no data persists)

### Verification Pass
- Content word survival check
- Inline code protection
- Unusual word context preservation
- Content loss threshold (>30% → fallback to original)

### SDK & Adapters
- Anthropic adapter (real implementation)
- OpenAI adapter
- Google/Gemini adapter
- Generic adapter (OpenAI-compatible APIs)

### CLI
- `smart-token sharpen` — compress prompt files
- `smart-token stats` — view compression dashboard

### Rules Versioning
- Version 1.0.0
- Tier pinning support: `tier: "B@1.0"`
