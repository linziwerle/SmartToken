/**
 * Custom ESLint rule: no-raw-regex-in-rules
 *
 * Enforces that compression rules use the CompressionRule interface
 * (with name, pattern, replacement, tier) instead of inline regex
 * replacements. Raw .replace(/pattern/, "...") calls in the engine
 * are hard to test, version, and debug individually.
 *
 * Applies to: src/engine/layer1-message.ts, src/rules/*.ts
 * Ignores: cleanup regexes in the compress function (whitespace normalization)
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer CompressionRule objects over inline regex replacements in rule files",
    },
    messages: {
      useCompressionRule:
        "Use a CompressionRule object instead of inline .replace() with regex. This makes the rule testable and versionable.",
    },
  },
  create(context) {
    const filename = context.getFilename();
    // Only apply to rules files
    if (!filename.includes("/rules/")) return {};

    return {
      CallExpression(node) {
        // Match: someString.replace(/regex/, "replacement")
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "replace" &&
          node.arguments.length >= 2 &&
          node.arguments[0].type === "Literal" &&
          node.arguments[0].regex
        ) {
          // Check if this is inside a CompressionRule array
          let parent = node.parent;
          let insideRuleArray = false;
          while (parent) {
            if (
              parent.type === "ArrayExpression" ||
              parent.type === "VariableDeclarator"
            ) {
              const src = context.getSourceCode().getText(parent);
              if (src.includes("CompressionRule")) {
                insideRuleArray = true;
                break;
              }
            }
            parent = parent.parent;
          }

          if (!insideRuleArray) {
            context.report({
              node,
              messageId: "useCompressionRule",
            });
          }
        }
      },
    };
  },
};
