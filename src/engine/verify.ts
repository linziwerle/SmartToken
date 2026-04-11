/**
 * Compression Verification Pass
 *
 * Sits between compression and output. Catches cases where stripping
 * removed context that was actually doing work:
 *
 * 1. Content words accidentally stripped (filler rules eating real words)
 * 2. Unusual words losing disambiguating context (typos, domain terms)
 * 3. Inline code references mangled by filler rules
 *
 * Strategy: compare original vs compressed, restore context where needed.
 * No ML — rule-based, fast, deterministic.
 */

import type { Tier } from "../types/index.ts";

// ── Significant word extraction ──
// Words that carry meaning — if one disappears, something went wrong
const STOPWORDS = new Set([
  // pronouns / subjects (expected to be stripped)
  "i", "me", "my", "you", "your", "we", "our", "he", "she", "they",
  // articles (stripped at tier C)
  "a", "an", "the",
  // linking verbs
  "is", "are", "was", "were", "be", "been", "am",
  // auxiliaries
  "have", "has", "had", "do", "does", "did",
  "can", "could", "would", "should", "will", "shall", "might", "may",
  // prepositions
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "into",
  "about", "between", "through", "after", "before",
  // conjunctions
  "and", "but", "or", "so", "if", "then", "that", "which", "when",
  // filler (expected to be stripped)
  "just", "basically", "actually", "really", "very", "like",
  "well", "please", "thanks", "thank", "sorry", "hello", "hey", "hi",
  // demonstratives
  "this", "that", "these", "those", "it", "its",
  // misc
  "not", "no", "yes", "ok", "okay", "got", "get",
  // AI model names (deliberately stripped by greeting rules)
  "claude", "chatgpt", "gpt", "gemini", "copilot",
  // words our rules deliberately strip (should not trigger content loss)
  "help", "assist", "wondering", "maybe", "perhaps", "think",
  "hope", "need", "want", "would", "there", "here",
  "much", "advance", "hmm", "umm", "hm",
  // pronoun framing verbs (stripped when user describes their action)
  "wrote", "created", "made", "built", "tried", "wrote",
  // other commonly stripped
  "going", "trying", "looking", "guess", "suppose",
]);

function getContentWords(text: string): string[] {
  // Remove tone/intent prefix before analyzing
  const body = text.replace(/^\[.*?\]\s*/, "");
  return body
    .toLowerCase()
    .replace(/`[^`]+`/g, "") // skip inline code (handled separately)
    .replace(/```[\s\S]*?```/g, "") // skip code blocks
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// ── Inline code detection ──
// Backtick-wrapped terms that our rules might mangle
// Must strip fenced code blocks first to avoid false matches
function getInlineCode(text: string): string[] {
  // Remove fenced code blocks before looking for inline code
  const withoutFenced = text.replace(/```[\s\S]*?```/g, "");
  const matches = withoutFenced.match(/`([^`\n]+)`/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/`/g, ""));
}

// ── Unusual word detection ──
// Words that aren't common English — likely typos, variable names, or domain terms
// These need their surrounding context to survive compression
const COMMON_WORDS = new Set([
  // Top ~200 English words that appear in programming contexts
  "function", "return", "class", "const", "let", "var", "new", "null",
  "true", "false", "string", "number", "boolean", "array", "object",
  "error", "file", "code", "test", "data", "type", "name", "value",
  "list", "map", "set", "key", "index", "item", "node", "path",
  "import", "export", "default", "async", "await", "promise",
  "request", "response", "server", "client", "database", "query",
  "user", "password", "token", "auth", "login", "page", "route",
  "component", "state", "props", "event", "handler", "callback",
  "build", "run", "start", "stop", "create", "read", "update", "delete",
  "add", "remove", "fix", "check", "find", "search", "sort", "filter",
  "change", "move", "copy", "save", "load", "send", "receive",
  "open", "close", "show", "hide", "enable", "disable",
  "input", "output", "config", "option", "setting", "parameter",
  "message", "log", "debug", "info", "warn", "warning",
  "button", "text", "image", "link", "form", "table", "header", "footer",
  "style", "color", "size", "width", "height", "margin", "padding",
  "api", "url", "http", "json", "html", "css", "sql",
  "app", "web", "mobile", "ios", "android", "swift", "react",
  "claude", "chatgpt", "gpt", "gemini", "copilot", "anthropic", "openai",
  "python", "javascript", "typescript", "java", "golang", "ruby", "rust",
  "node", "bun", "deno", "webpack", "vite", "docker", "kubernetes",
  "github", "gitlab", "bitbucket", "jira", "slack", "redis", "postgres",
  "mysql", "mongo", "mongodb", "graphql", "rest", "restful", "websocket",
  "need", "want", "make", "use", "try", "help", "work", "look",
  "think", "know", "see", "give", "take", "put", "call", "write",
  "first", "last", "next", "previous", "current", "same", "different",
  "each", "every", "all", "any", "both", "other", "another",
  "good", "bad", "big", "small", "old", "new", "right", "wrong",
  "how", "what", "why", "where", "when", "who", "which",
  "here", "there", "now", "then", "still", "already", "always", "never",
  "also", "only", "even", "more", "less", "most", "least",
  "because", "since", "until", "while", "during", "without",
  "instead", "rather", "either", "neither", "whether", "however",
  "able", "available", "possible", "specific", "similar",
  "process", "system", "module", "package", "library", "framework",
  "version", "issue", "problem", "solution", "approach", "method",
  "project", "folder", "directory", "branch", "commit", "merge",
  "using", "inside", "between", "across", "against", "along",
  "above", "below", "under", "over", "within", "around",
]);

function isUnusualWord(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length <= 2) return false;
  if (STOPWORDS.has(w)) return false;
  if (COMMON_WORDS.has(w)) return false;
  if (/^\d+$/.test(w)) return false; // pure numbers
  // Check common morphological variants
  if (/^[a-z]+ing$/.test(w) && COMMON_WORDS.has(w.replace(/ing$/, ""))) return false;
  if (/^[a-z]+ed$/.test(w) && COMMON_WORDS.has(w.replace(/ed$/, ""))) return false;
  if (/^[a-z]+s$/.test(w) && COMMON_WORDS.has(w.replace(/s$/, ""))) return false;
  if (/^[a-z]+er$/.test(w) && COMMON_WORDS.has(w.replace(/er$/, ""))) return false;
  if (/^[a-z]+ly$/.test(w) && COMMON_WORDS.has(w.replace(/ly$/, ""))) return false;
  if (/^[a-z]+tion$/.test(w)) return false; // most -tion words are common enough
  if (/^[a-z]+ment$/.test(w)) return false; // most -ment words are common enough
  return true;
}

// ── Context radius ──
// For unusual words, grab N words before and after from the original
function getContextAroundWord(
  original: string,
  word: string,
  radius = 3
): string | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:\\S+\\s+){0,${radius}}\\b${escaped}\\b(?:\\s+\\S+){0,${radius}}`,
    "i"
  );
  const match = original.match(pattern);
  return match ? match[0] : null;
}

// ── Verification result ──
export interface VerifyResult {
  compressed: string;
  restored: boolean;
  warnings: string[];
  restoredWords: string[];
}

/**
 * Verify compression didn't lose critical content.
 *
 * Checks:
 * 1. All content words from original survive in compressed
 * 2. Inline code references survive intact
 * 3. Unusual words have enough surrounding context
 *
 * If issues found: restore missing context from original.
 */
export function verifyCompression(
  original: string,
  compressed: string,
  _tier: Tier = "B"
): VerifyResult {
  const warnings: string[] = [];
  const restoredWords: string[] = [];
  let result = compressed;
  let restored = false;

  // ── Check 1: Content word survival ──
  // Compare only non-code-block text — code blocks have their own
  // compression rules (Layer 2) and shouldn't trigger content loss
  const stripCodeBlocks = (t: string) =>
    t.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");

  const originalWords = getContentWords(stripCodeBlocks(original));
  const compressedLower = stripCodeBlocks(compressed).toLowerCase();

  const missingWords: string[] = [];
  for (const word of originalWords) {
    if (!compressedLower.includes(word)) {
      // Word disappeared — is it a content word we care about?
      // Skip if it's a word our rules deliberately strip
      if (!STOPWORDS.has(word)) {
        missingWords.push(word);
      }
    }
  }

  // ── Check 2: Inline code survival ──
  const originalCode = getInlineCode(original);
  for (const code of originalCode) {
    if (!compressed.includes(code)) {
      warnings.push(`inline code \`${code}\` was mangled`);
      // Fall back to original — never inject tags or append content
      result = original;
      restored = true;
      restoredWords.push(code);
      return { compressed: result, restored, warnings, restoredWords };
    }
  }

  // ── Check 3: Unusual words need context ──
  for (const word of missingWords) {
    if (isUnusualWord(word)) {
      // This word isn't common English — might be a typo, variable name,
      // or domain term. Fall back to original rather than injecting tags.
      warnings.push(`unusual word "${word}" lost context, restoring original`);
      result = original;
      restored = true;
      restoredWords.push(word);
      return { compressed: result, restored, warnings, restoredWords };
    }
  }

  // ── Check 4: Critical missing content words ──
  // If >30% of content words disappeared, compression was too aggressive
  if (missingWords.length > 0 && originalWords.length > 0) {
    const lossRatio = missingWords.length / originalWords.length;
    if (lossRatio > 0.3) {
      warnings.push(
        `high content loss (${(lossRatio * 100).toFixed(0)}%) — ` +
        `missing: ${missingWords.join(", ")}`
      );
      // Fall back to original — compression destroyed too much
      result = original;
      restored = true;
    }
  }

  return { compressed: result, restored, warnings, restoredWords };
}

/**
 * Quick check: does this text contain words that look like
 * they could be accidentally stripped by filler rules?
 *
 * Use BEFORE compression to flag risky inputs.
 */
export function detectRiskyContent(text: string): string[] {
  const risks: string[] = [];

  // Inline code that contains filler-like words
  const inlineCode = getInlineCode(text);
  const fillerLike = ["just", "like", "well", "actually", "basically", "so"];
  for (const code of inlineCode) {
    if (fillerLike.some((f) => code.toLowerCase().includes(f))) {
      risks.push(`inline code \`${code}\` contains filler-like word`);
    }
  }

  // Unusual words that might need context to disambiguate
  const words = text
    .replace(/`[^`]+`/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const word of words) {
    if (isUnusualWord(word)) {
      risks.push(`"${word}" is unusual — context may be needed`);
    }
  }

  return risks;
}
