import type { Layer, CompressionConfig } from "../types/index.ts";

// ── CSV compression ──
function compressCSV(text: string): string {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= 50) return text; // small enough to send as-is

  const header = lines[0]!;
  const dataLines = lines.slice(1);

  // Schema: column names
  const columns = header.split(",").map((c) => c.trim());

  // First 10 rows as examples
  const examples = dataLines.slice(0, 10).join("\n");

  // Summary stats for numeric columns
  const stats = computeCSVStats(columns, dataLines);

  return [
    `[CSV: ${columns.length} columns, ${dataLines.length} rows]`,
    `Schema: ${header}`,
    "",
    "First 10 rows:",
    examples,
    "",
    `...${dataLines.length - 10} rows omitted`,
    stats ? `\nColumn stats:\n${stats}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function computeCSVStats(columns: string[], dataLines: string[]): string {
  const stats: string[] = [];

  for (let col = 0; col < columns.length; col++) {
    const values = dataLines
      .map((line) => {
        const parts = line.split(",");
        return parts[col]?.trim() ?? "";
      })
      .filter((v) => v.length > 0);

    const numValues = values.map(Number).filter((n) => !isNaN(n));
    if (numValues.length > values.length * 0.5) {
      // Mostly numeric column
      const min = Math.min(...numValues);
      const max = Math.max(...numValues);
      const avg = numValues.reduce((a, b) => a + b, 0) / numValues.length;
      stats.push(
        `  ${columns[col]}: min=${min}, max=${max}, avg=${avg.toFixed(2)}`
      );
    } else {
      // Categorical — count unique values
      const unique = new Set(values).size;
      stats.push(`  ${columns[col]}: ${unique} unique values`);
    }
  }

  return stats.join("\n");
}

// ── JSON compression ──
function compressJSON(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return compressJSONValue(parsed, 0);
  } catch {
    // If it doesn't parse, just minify whitespace
    return text.replace(/\n\s+/g, " ").replace(/\s{2,}/g, " ");
  }
}

function compressJSONValue(value: unknown, depth: number): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";

    // If array has >10 identical-structure objects, show schema + examples
    if (
      value.length > 10 &&
      typeof value[0] === "object" &&
      value[0] !== null
    ) {
      const schema = Object.keys(value[0] as Record<string, unknown>);
      const allSameStructure = value.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          arraysEqual(Object.keys(item as Record<string, unknown>), schema)
      );

      if (allSameStructure) {
        const examples = value
          .slice(0, 3)
          .map((item) => JSON.stringify(item))
          .join(",\n  ");
        return [
          `[/* ${value.length} items, schema: {${schema.join(", ")}} */`,
          `  ${examples},`,
          `  /* ...${value.length - 3} more items */`,
          `]`,
        ].join("\n");
      }
    }

    // Small array — minify
    return JSON.stringify(value);
  }

  // Object — minify
  if (depth > 5) return JSON.stringify(value); // prevent deep recursion
  return JSON.stringify(value);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

// ── XML compression ──
function compressXML(text: string): string {
  let result = text;

  // Strip namespace declarations (keep first, remove duplicates)
  const namespaces = new Set<string>();
  result = result.replace(/\s+xmlns(?::\w+)?="[^"]*"/g, (match) => {
    if (namespaces.has(match.trim())) return "";
    namespaces.add(match.trim());
    return match;
  });

  // Strip auto-generated ID attributes
  result = result.replace(/\s+id="(?:element_|_)\d+"/g, "");

  // Strip generation metadata comments
  result = result.replace(/<!--\s*(?:Generated|Auto-generated|Created)\s+by\s+[^>]+-->/gi, "");

  // Strip DTD/schema declarations
  result = result.replace(/<!DOCTYPE[^>]*>/gi, "");
  result = result.replace(
    /<\?xml[^?]*\?>\s*/gi,
    '<?xml version="1.0"?>\n'
  );

  // Strip CDATA that wraps simple text
  result = result.replace(/<!\[CDATA\[((?:(?!\]\]>).)*)\]\]>/g, (_, content: string) => {
    // If CDATA just wraps plain text, unwrap it
    if (!/[<>&]/.test(content)) return content;
    return `<![CDATA[${content}]]>`;
  });

  // Collapse blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

// ── HTML compression ──
function compressHTML(text: string): string {
  let result = text;

  // Strip script tags and content
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  // Strip style tags and content
  result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // Strip meta tags (except title-related)
  result = result.replace(
    /<meta\b(?![^>]*(?:title|description|charset))[^>]*\/?>/gi,
    ""
  );

  // Strip SEO / social / analytics tags
  result = result.replace(
    /<(?:link\s+rel="(?:canonical|preconnect|dns-prefetch|preload)")[^>]*\/?>/gi,
    ""
  );

  // Strip inline SVG paths (huge token cost)
  result = result.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "<svg>...</svg>");

  // Compress Tailwind class soup — keep structural classes only
  result = result.replace(/\bclass="([^"]*)"/g, (match, classes: string) => {
    const classList = classes.split(/\s+/);
    if (classList.length <= 5) return match; // short enough

    // Keep structural and semantic classes, strip utility noise
    const structural = classList.filter(
      (c) =>
        /^(?:flex|grid|block|inline|hidden|relative|absolute|fixed|sticky)/.test(c) ||
        /^(?:w-|h-|min-|max-)/.test(c) ||
        /^(?:container|wrapper|header|footer|sidebar|nav|main|section)/.test(c) ||
        !/^(?:p[xytblr]?-|m[xytblr]?-|text-|bg-|border-|rounded|shadow|opacity|transition|duration|ease|transform|cursor|select|ring|outline|placeholder|decoration|leading|tracking|font-|align-)/.test(c)
    );

    const stripped = classList.length - structural.length;
    if (stripped > 0) {
      return `class="${structural.join(" ")} /* +${stripped} utility classes */"`;
    }
    return match;
  });

  // Flatten excessive div nesting (>5 levels with no content between)
  // Simple heuristic: remove empty wrapper divs
  result = result.replace(
    /<div\b[^>]*>\s*(<div\b)/gi,
    "$1"
  );

  // Collapse blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

// ── Markdown compression ──
function compressMarkdown(text: string): string {
  let result = text;

  // Strip HTML embedded in markdown
  result = result.replace(/<(?:div|span|br|hr)\s*\/?>/gi, "");
  result = result.replace(/<(?:div|span)[^>]*>[\s\S]*?<\/(?:div|span)>/gi, "");

  // Strip link reference definitions at the bottom
  result = result.replace(/^\[[\w-]+\]:\s+https?:\/\/\S+\s*$/gm, "");

  // Collapse excessive blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

// ── Content type detection ──
function detectContentType(
  text: string
): "csv" | "json" | "xml" | "html" | "markdown" | "text" {
  const trimmed = text.trim();

  // JSON
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // not valid JSON
    }
  }

  // HTML (check before XML — HTML is a subset)
  if (/<(?:html|head|body|div|span|p|a|img|table|form|script|style|section|article|nav|header|footer|main|ul|ol|li|h[1-6])\b/i.test(trimmed)) {
    return "html";
  }

  // XML
  if (trimmed.startsWith("<?xml") || /^<\w+[^>]*>/.test(trimmed) && /<\/\w+>\s*$/.test(trimmed)) {
    return "xml";
  }

  // CSV (multiple lines with consistent comma/tab counts)
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > 2) {
    const commaCount = (lines[0]!.match(/,/g)?.length ?? 0);
    if (commaCount > 0) {
      const consistent = lines
        .slice(1, 5)
        .every(
          (l) =>
            Math.abs((l.match(/,/g)?.length ?? 0) - commaCount) <= 1
        );
      if (consistent) return "csv";
    }
  }

  // Markdown
  if (/^#{1,6}\s/m.test(trimmed) || /^\s*[-*]\s/m.test(trimmed) || /\[.*\]\(.*\)/.test(trimmed)) {
    return "markdown";
  }

  return "text";
}

// ── Cross-layer relevance ──
// Given user's message, extract what the question is about
function extractQueryTerms(message: string): Set<string> {
  return new Set(
    message
      .toLowerCase()
      .replace(/[^a-z0-9\s_.-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

// ── JSON key trimming based on user message ──
function trimJSONToRelevantKeys(
  text: string,
  queryTerms: Set<string>
): string {
  if (queryTerms.size === 0) return compressJSON(text);
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return compressJSON(text);

    const obj = parsed as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length <= 10) return compressJSON(text); // small enough

    // Keep keys that match query terms
    const relevant: Record<string, unknown> = {};
    const omitted: string[] = [];

    for (const key of keys) {
      const keyLower = key.toLowerCase();
      const isRelevant = [...queryTerms].some(
        (t) => keyLower.includes(t) || t.includes(keyLower)
      );
      if (isRelevant) {
        relevant[key] = obj[key];
      } else {
        omitted.push(key);
      }
    }

    if (omitted.length === 0) return compressJSON(text);

    const result = JSON.stringify(relevant);
    return `${result}\n/* ${omitted.length} keys omitted: ${omitted.slice(0, 5).join(", ")}${omitted.length > 5 ? "..." : ""} */`;
  } catch {
    return compressJSON(text);
  }
}

// ── Main file/media processor ──
export function processFileContent(
  text: string,
  userMessage?: string
): string {
  const contentType = detectContentType(text);
  const queryTerms = userMessage ? extractQueryTerms(userMessage) : new Set<string>();

  switch (contentType) {
    case "csv":
      return compressCSV(text);
    case "json":
      return queryTerms.size > 0
        ? trimJSONToRelevantKeys(text, queryTerms)
        : compressJSON(text);
    case "xml":
      return compressXML(text);
    case "html":
      return compressHTML(text);
    case "markdown":
      return compressMarkdown(text);
    default:
      return text;
  }
}

// ── Layer interface ──
export const layer3: Layer = {
  name: "media-compressor",
  process(text: string, config: CompressionConfig): string {
    if (!config.media) return text;

    // Layer 3 processes file content that appears in the message
    // Look for embedded data blocks that aren't code (JSON, CSV, XML, HTML)
    // Code blocks are handled by Layer 2
    let result = text;

    // Process non-code fenced blocks (json, xml, html, csv)
    result = result.replace(
      /```(json|xml|html|csv|markdown|md)\n([\s\S]*?)```/gi,
      (match, label: string, content: string) => {
        const processed = processFileContent(content.trim());
        return `\`\`\`${label}\n${processed}\n\`\`\``;
      }
    );

    // Process inline JSON/XML/CSV that isn't in code blocks
    // (large blocks of data pasted directly)
    const lines = result.split("\n");
    const dataBlockStart = findDataBlockStart(lines);

    if (dataBlockStart !== null) {
      const beforeData = lines.slice(0, dataBlockStart).join("\n");
      const dataBlock = lines.slice(dataBlockStart).join("\n");
      const processed = processFileContent(dataBlock);
      result = beforeData + "\n" + processed;
    }

    return result;
  },
};

function findDataBlockStart(lines: string[]): number | null {
  // Look for where a large data block starts
  // Heuristic: 20+ consecutive lines that look like JSON/XML/CSV
  let consecutiveDataLines = 0;
  let startLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const isDataLine =
      /^[{[\]},]/.test(line) || // JSON
      /^<\/?[\w:]+/.test(line) || // XML
      (line.split(",").length > 2 && !/\b(?:and|or|but)\b/i.test(line)); // CSV

    if (isDataLine) {
      if (consecutiveDataLines === 0) startLine = i;
      consecutiveDataLines++;
    } else {
      if (consecutiveDataLines >= 20) return startLine;
      consecutiveDataLines = 0;
    }
  }

  if (consecutiveDataLines >= 20) return startLine;
  return null;
}

// Export for testing
export {
  compressCSV,
  compressJSON,
  compressXML,
  compressHTML,
  compressMarkdown,
  detectContentType,
};
