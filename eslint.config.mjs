import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

// Architecture policy lists. Empty at v0.0.0 — populated as SPEC.md anchors
// land and the right boundaries surface.
const ARCHITECTURE_OPTIONS = {
  forbiddenSubpathSegments: [],
  implementationPathSegments: [],
  sharedFolderNames: [],
  infrastructureTypePackages: [],
  allowedPublicSubpaths: [],
  allowedTestPublicSubpaths: [],
  publicTypePackages: [],
  layers: [],
  packageRuntime: "node",
};

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/.safer-spec-cache/**",
      "**/coverage/**",
    ],
  },

  // Application source: recommended + strict + architecture.
  // Use the preset's bundled plugins / settings so sonarjs auto-registers.
  {
    files: ["packages/*/src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: guard.configs.strict.plugins,
    settings: {
      ...guard.configs.strict.settings,
      "agent-code-guard": ARCHITECTURE_OPTIONS,
    },
    rules: {
      ...guard.configs.strict.rules,
      ...guard.configs.architecture.rules,
    },
  },

  // Tests: strict preset + integration-test rules.
  {
    files: [
      "packages/*/src/**/*.{test,spec}.ts",
      "packages/*/test/**/*.ts",
      "packages/*/tests/**/*.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: guard.configs.strict.plugins,
    settings: guard.configs.strict.settings,
    rules: {
      ...guard.configs.strict.rules,
      ...guard.configs.integrationTests.rules,
    },
  },
];
