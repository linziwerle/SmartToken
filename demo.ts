#!/usr/bin/env bun
/**
 * Smart Token — Live compression demo
 * Run: bun demo.ts
 */

import { compressRequestBody } from "./src/proxy/compress-request.ts";
import { countTokens } from "./src/engine/token-counter.ts";

// ── Colors ──
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const strike = (s: string) => `\x1b[9m\x1b[2m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;

function bar(pct: number, width = 30): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return green("█".repeat(filled)) + dim("░".repeat(empty));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Realistic API request ──
// This is what a real coding session looks like after ~15 minutes
const request = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  system: [
    "You are a senior iOS engineer helping with Swift development.",
    "You must always write clean, readable code. Never write messy code.",
    "Always follow Swift naming conventions. Do not use non-standard naming conventions.",
    "You should always use self. when accessing instance properties. Never access instance properties without self.",
    "You are an expert in UIKit and SwiftUI. You have deep knowledge of UIKit and SwiftUI frameworks.",
    "Always explain your reasoning. Do not skip explanations.",
    "When reviewing code, always check for memory leaks. Never ignore potential memory leaks.",
    "You should always suggest unit tests. Do not forget to mention unit tests.",
    "Always use guard let for optional unwrapping when possible. Never use force unwrapping unless absolutely necessary.",
    "You are helpful, professional, and thorough. Always be helpful, professional, and thorough in your responses.",
  ].join(" "),
  messages: [
    {
      role: "user",
      content:
        "Hey Claude! I'm working on a SwiftUI app and I need help with a view model pattern.",
    },
    {
      role: "assistant",
      content:
        "I'd be happy to help with your SwiftUI view model pattern. What specific aspect are you working on?",
    },
    {
      role: "user",
      content:
        "So basically I have this view that shows a list of items fetched from an API. I want to handle loading, error, and success states.",
    },
    {
      role: "assistant",
      content:
        "Great, that's a common pattern. You'll want an enum for the view state and an ObservableObject view model. Let me show you a basic structure.",
    },
    {
      role: "user",
      content: `Yeah that sounds right. Here's what I have so far:

\`\`\`swift
class ItemListViewModel: ObservableObject {
    // TODO: Add published properties
    // NOTE: This is a work in progress
    // Created by Lin on 2026-04-10
    // Copyright 2026 All rights reserved.

    @Published var items: [Item] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    // MARK: - Properties

    private let apiService: APIService

    // MARK: - Initialization

    /// Initialize with an API service
    /// - Parameter apiService: The service to use for API calls
    init(apiService: APIService = APIService()) {
        self.apiService = apiService
    }

    // MARK: - Public Methods

    /// Fetch items from the API
    /// This method fetches all items and updates the published properties
    /// It handles loading state and error handling automatically
    func fetchItems() async {
        // Set loading to true
        isLoading = true
        // Clear any previous error
        errorMessage = nil

        do {
            // Fetch items from API
            let fetchedItems = try await apiService.fetchItems()
            // Update items on main thread
            await MainActor.run {
                // Set the items
                self.items = fetchedItems
                // Set loading to false
                self.isLoading = false
            }
        } catch {
            // Handle error
            await MainActor.run {
                // Set error message
                self.errorMessage = error.localizedDescription
                // Set loading to false
                self.isLoading = false
            }
        }
    }

    // func oldFetchItems() {
    //     URLSession.shared.dataTask(with: url) { data, response, error in
    //         if let data = data {
    //             let items = try? JSONDecoder().decode([Item].self, from: data)
    //             DispatchQueue.main.async {
    //                 self.items = items ?? []
    //             }
    //         }
    //     }.resume()
    // }
}
\`\`\``,
    },
    {
      role: "assistant",
      content:
        "Good start! I see a few things we can improve. First, you're using separate Bool and String properties for state - let's use an enum instead. Second, the commented-out old implementation can be removed. Third, the comments are mostly restating what the code does.",
    },
    {
      role: "user",
      content: `Oh right, yeah I forgot to clean that up. Can you show me the enum approach? Also I just realized I should probably show you the API response format. Here's what the JSON looks like:

\`\`\`json
[
  {"id": 1, "name": "Widget A", "price": 29.99, "category": "tools", "inStock": true, "rating": 4.5, "reviewCount": 128, "sku": "WDG-001", "createdAt": "2026-01-15T10:30:00Z", "updatedAt": "2026-03-20T14:22:00Z"},
  {"id": 2, "name": "Widget B", "price": 49.99, "category": "tools", "inStock": true, "rating": 4.2, "reviewCount": 89, "sku": "WDG-002", "createdAt": "2026-01-16T11:00:00Z", "updatedAt": "2026-03-21T09:15:00Z"},
  {"id": 3, "name": "Gadget X", "price": 19.99, "category": "electronics", "inStock": false, "rating": 3.8, "reviewCount": 45, "sku": "GDG-001", "createdAt": "2026-02-01T08:00:00Z", "updatedAt": "2026-03-15T16:45:00Z"},
  {"id": 4, "name": "Gadget Y", "price": 89.99, "category": "electronics", "inStock": true, "rating": 4.8, "reviewCount": 234, "sku": "GDG-002", "createdAt": "2026-02-10T13:20:00Z", "updatedAt": "2026-04-01T10:00:00Z"},
  {"id": 5, "name": "Doohickey", "price": 9.99, "category": "misc", "inStock": true, "rating": 3.5, "reviewCount": 12, "sku": "DHK-001", "createdAt": "2026-03-01T07:30:00Z", "updatedAt": "2026-03-28T11:10:00Z"},
  {"id": 6, "name": "Thingamajig", "price": 149.99, "category": "premium", "inStock": false, "rating": 4.9, "reviewCount": 567, "sku": "THG-001", "createdAt": "2026-01-20T09:45:00Z", "updatedAt": "2026-04-05T15:30:00Z"},
  {"id": 7, "name": "Whatchamacallit", "price": 34.99, "category": "tools", "inStock": true, "rating": 4.1, "reviewCount": 78, "sku": "WTC-001", "createdAt": "2026-02-14T12:00:00Z", "updatedAt": "2026-03-30T08:20:00Z"},
  {"id": 8, "name": "Doodad", "price": 59.99, "category": "electronics", "inStock": true, "rating": 4.6, "reviewCount": 156, "sku": "DOD-001", "createdAt": "2026-02-20T14:30:00Z", "updatedAt": "2026-04-02T11:45:00Z"},
  {"id": 9, "name": "Contraption", "price": 199.99, "category": "premium", "inStock": true, "rating": 4.7, "reviewCount": 312, "sku": "CNT-001", "createdAt": "2026-03-05T10:15:00Z", "updatedAt": "2026-04-08T09:00:00Z"},
  {"id": 10, "name": "Apparatus", "price": 74.99, "category": "tools", "inStock": false, "rating": 4.0, "reviewCount": 67, "sku": "APP-001", "createdAt": "2026-03-10T16:00:00Z", "updatedAt": "2026-04-06T13:30:00Z"}
]
\`\`\`

There are usually about 50-100 items in a real response but this is the format.`,
    },
    {
      role: "user",
      content:
        "Actually wait, I also wanted to ask - should I be using @MainActor on the whole class instead of wrapping individual calls? I saw that approach somewhere and I'm not sure which is better.",
    },
    {
      role: "assistant",
      content:
        "Great question! Yes, marking the entire class with @MainActor is the modern approach in Swift. It ensures all property updates happen on the main thread automatically, so you don't need those MainActor.run blocks.",
    },
    {
      role: "user",
      content:
        "Oh cool, that's much cleaner. So basically I should just add @MainActor to the class declaration and remove the MainActor.run wrappers? That simplifies things a lot.",
    },
    {
      role: "assistant",
      content:
        "Exactly. Just add @MainActor before the class declaration and remove the MainActor.run blocks. The compiler will handle thread safety for you.",
    },
    {
      role: "user",
      content:
        "Perfect, thanks so much! Now can you please show me the full refactored version with the state enum and @MainActor? I want to make sure I'm doing it right.",
    },
  ],
};

// ── Run ──
async function main() {
  console.log("");
  console.log(bold("  ⚡ Smart Token"));
  console.log(dim("  Don't change how you talk. Optimize what gets sent.\n"));

  // Count originals
  const sysTokens = countTokens(request.system);
  let userTokens = 0;
  let assistantTokens = 0;
  for (const msg of request.messages) {
    const count = countTokens(msg.content);
    if (msg.role === "user") userTokens += count;
    else assistantTokens += count;
  }
  const totalOriginal = sysTokens + userTokens + assistantTokens;

  console.log(dim("  ── Input ──────────────────────────────────────────"));
  console.log(`  System prompt       ${dim(sysTokens + " tokens")}`);
  console.log(`  User messages (7)   ${dim(userTokens + " tokens")}`);
  console.log(`  Asst messages (5)   ${dim(assistantTokens + " tokens")}`);
  console.log(`  ${bold("Total")}                ${bold(totalOriginal + " tokens")}`);
  console.log("");

  // Animate compression
  const layers = [
    ["Layer 5", "History", "deduplicating conversation history..."],
    ["Layer 4", "System", "collapsing redundant instructions..."],
    ["Layer 3", "Media", "compressing JSON data blocks..."],
    ["Layer 2", "Code", "stripping comments & dead code..."],
    ["Layer 1", "Message", "trimming filler, preserving intent..."],
  ];

  console.log(dim("  ── Compressing ────────────────────────────────────"));
  for (const [id, name, desc] of layers) {
    process.stdout.write(`  ${cyan(id!)} ${name} ${dim("→ " + desc!)}`);
    await sleep(400);
    console.log("");
  }
  console.log("");

  // Compress
  const result = compressRequestBody(JSON.parse(JSON.stringify(request)), {
    messages: true,
    codeBlocks: true,
    media: true,
    systemPrompt: true,
    history: true,
    tier: "B",
  });

  const { totalOriginalTokens, totalCompressedTokens, totalSaved } = result.stats;
  const pct = ((totalSaved / totalOriginalTokens) * 100).toFixed(1);

  // Results
  console.log(dim("  ── Results ────────────────────────────────────────"));
  console.log(`  Original     ${bold(totalOriginal + "")} tokens`);
  console.log(`  Compressed   ${green(totalCompressedTokens + "")} tokens`);
  console.log(`  ${bold("Saved")}        ${green(totalSaved + "")} tokens ${green("(" + pct + "%)")}`);
  console.log("");
  console.log(`  ${bar(parseFloat(pct))}`);
  console.log("");

  // What each layer caught
  const compressed = result.body as typeof request;

  console.log(dim("  ── What was removed ───────────────────────────────\n"));

  // System prompt diff
  console.log(`  ${yellow("System prompt")}`);
  console.log(dim("  before: ") + strike("Never write messy code."));
  console.log(dim("          ") + strike("You are an expert in UIKit and SwiftUI."));
  console.log(dim("          ") + strike("Do not forget to mention unit tests."));
  console.log(dim("  why:    ") + dim("duplicates of existing positive rules\n"));

  // Code
  console.log(`  ${yellow("Code block")}`);
  console.log(dim("  before: ") + strike("// Created by Lin on 2026-04-10"));
  console.log(dim("          ") + strike("// Copyright 2026 All rights reserved."));
  console.log(dim("          ") + strike("// Set loading to true"));
  console.log(dim("          ") + strike("// func oldFetchItems() { ... }") + dim("  (13 lines)"));
  console.log(dim("  why:    ") + dim("copyright headers, restating comments, dead code\n"));

  // JSON
  console.log(`  ${yellow("JSON data")}`);
  console.log(dim("  before: ") + strike("10 objects × 10 fields each"));
  console.log(dim("  after:  ") + dim("schema + 3 examples"));
  console.log(dim("  why:    ") + dim("identical structure, only need shape + sample\n"));

  // Messages
  console.log(`  ${yellow("Messages")}`);
  console.log(dim("  before: ") + strike("Hey Claude!") + dim(" · ") + strike("So basically") + dim(" · ") + strike("thanks so much"));
  console.log(dim("  after:  ") + cyan("[polite, build]") + dim(" prefix preserves tone"));
  console.log(dim("  why:    ") + dim("filler words, not meaning\n"));

  // What was kept
  console.log(dim("  ── What was kept ─────────────────────────────────\n"));
  console.log(`  ${green("✓")} All code logic and structure`);
  console.log(`  ${green("✓")} Technical questions and requirements`);
  console.log(`  ${green("✓")} JSON schema and data shape`);
  console.log(`  ${green("✓")} Emotional cues (${cyan('"Oh cool"')}, ${cyan('"I\'m not sure"')})`);
  console.log(`  ${green("✓")} IMPORTANT/WARNING comments in code`);
  console.log(`  ${green("✓")} Every constraint and condition`);
  console.log("");

  // Scale projection
  console.log(dim("  ── At scale ──────────────────────────────────────\n"));

  const reqPerDay = 100;
  const savedPerDay = totalSaved * reqPerDay;
  const models = [
    ["Claude Sonnet 4.6", 3.0],
    ["Claude Opus 4.6", 5.0],
    ["GPT-4.1", 2.0],
    ["GPT-4o", 2.5],
  ] as const;

  console.log(dim("  ~100 API requests/day, " + pct + "% avg savings:\n"));
  console.log(
    `  ${"Model".padEnd(20)} ${"Daily".padEnd(12)} ${"Monthly".padEnd(12)} ${"Yearly"}`
  );
  console.log(dim("  " + "─".repeat(56)));

  for (const [model, rate] of models) {
    const daily = (savedPerDay / 1_000_000) * rate;
    const monthly = daily * 22; // workdays
    const yearly = monthly * 12;
    console.log(
      `  ${model.padEnd(20)} ${green("$" + daily.toFixed(2)).padEnd(20)} ${green("$" + monthly.toFixed(2)).padEnd(20)} ${green("$" + yearly.toFixed(2))}`
    );
  }

  console.log("");
  console.log(
    dim("  10-person team on Opus 4.6: ") +
      bold(green("$" + (((savedPerDay / 1_000_000) * 5 * 22 * 12 * 10).toFixed(0))))  +
      bold(green("/year saved"))
  );
  console.log("");

  // Footer
  console.log(dim("  ──────────────────────────────────────────────────"));
  console.log(`  ${bold("Zero instructions injected.")} All compression is local.`);
  console.log(`  The API never knows it happened.`);
  console.log("");
}

main();
