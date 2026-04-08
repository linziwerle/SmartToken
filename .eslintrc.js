module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    // Built-in: no console.log in src/ (use proper logging)
    "no-console": ["error", { allow: ["warn", "error"] }],
    // Allow unused vars starting with _
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    // Enforce consistent type imports
    "@typescript-eslint/consistent-type-imports": "warn",

    // Custom rule 1: Layer.process() must have try/catch
    // Prevents pipeline failures from unhandled layer errors
    "no-unhandled-layer-error": "warn",

    // Custom rule 2: Prefer CompressionRule objects over inline regex
    // in rule files — makes rules testable and versionable
    "no-raw-regex-in-rules": "warn",
  },
  overrides: [
    {
      // Allow console.log in CLI (it's the output mechanism)
      files: ["src/cli/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
    {
      // Allow console in tests
      files: ["tests/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  // Load custom rules from project directory
  rulesdir: ["eslint-rules"],
};
