/**
 * Custom ESLint rule: no-unhandled-layer-error
 *
 * Enforces that every Layer.process() implementation wraps its logic in
 * try/catch with pass-through fallback. A layer that throws breaks the
 * pipeline — this rule catches missing error handling at lint time.
 *
 * Detects: Layer implementations (objects with name + process method)
 * that have no try/catch inside the process function body.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Layer.process() must wrap logic in try/catch for safe fallback",
    },
    messages: {
      missingTryCatch:
        "Layer '{{name}}' process() has no try/catch. Layers must handle errors to prevent pipeline failure.",
    },
  },
  create(context) {
    return {
      // Match: { name: "...", process(...) { ... } }
      Property(node) {
        if (
          node.key.type === "Identifier" &&
          node.key.name === "process" &&
          node.value.type === "FunctionExpression"
        ) {
          const parent = node.parent;
          if (parent.type !== "ObjectExpression") return;

          // Check if sibling has name property (Layer interface)
          const hasName = parent.properties.some(
            (p) =>
              p.type === "Property" &&
              p.key.type === "Identifier" &&
              p.key.name === "name"
          );
          if (!hasName) return;

          // Check if function body has a TryStatement
          const body = node.value.body;
          const hasTryCatch = body.body.some(
            (stmt) => stmt.type === "TryStatement"
          );

          if (!hasTryCatch) {
            // Get the layer name
            const nameProp = parent.properties.find(
              (p) =>
                p.type === "Property" &&
                p.key.type === "Identifier" &&
                p.key.name === "name"
            );
            const layerName =
              nameProp?.value?.type === "Literal"
                ? nameProp.value.value
                : "unknown";

            context.report({
              node: node.key,
              messageId: "missingTryCatch",
              data: { name: layerName },
            });
          }
        },
      },
    };
  },
};
