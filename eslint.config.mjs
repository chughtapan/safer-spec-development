import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

// Severity promotion: `warn` rules in this repo are documented architectural
// drift signals (PRINCIPLES.md Principle 7: stop rules are literal). Promoting
// warn → error at the config level keeps the gate inside the config, not at
// the CLI flag, so the gate is the same in every environment that loads the
// config.
const promoteWarnToError = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([k, v]) => {
      const sev = Array.isArray(v) ? v[0] : v;
      const promoted = sev === "warn" || sev === 1 ? "error" : sev;
      return [k, Array.isArray(v) ? [promoted, ...v.slice(1)] : promoted];
    }),
  );

// Architecture rule options are read per-rule, not from settings. Inject the
// shared ARCHITECTURE_OPTIONS object into the architecture-family agent-code-guard
// rules so layers, sharedFolderNames, and publicTypePackages actually reach
// those rule implementations. Non-architecture rules (async-flow, effect,
// safety, etc.) accept zero options and reject extras at validation time.
const ARCHITECTURE_RULE_NAMES = new Set(
  Object.keys(guard.configs.architecture.rules),
);
const injectArchitectureOptions = (rules, options) =>
  Object.fromEntries(
    Object.entries(rules).map(([k, v]) => {
      if (!ARCHITECTURE_RULE_NAMES.has(k)) return [k, v];
      const sev = Array.isArray(v) ? v[0] : v;
      return [k, [sev, options]];
    }),
  );

// Architecture policy. Every list entry carries a written reason — the act of
// writing the reason IS the architectural decision (eslint-plugin-agent-code-guard
// README "Declaring the contract is the point").
const ARCHITECTURE_OPTIONS = {
  forbiddenSubpathSegments: [],
  implementationPathSegments: [],
  sharedFolderNames: [
    {
      folder: "errors",
      reason:
        "tagged-error registry; every domain module emits Effect.fail with errors from this kernel, so it is depended on by every other folder by design",
    },
  ],
  infrastructureTypePackages: [],
  allowedPublicSubpaths: [],
  allowedTestPublicSubpaths: [],
  publicTypePackages: [
    {
      package: "effect",
      reason:
        "the codemod's public API is Effect-native (Effect<T, E, R> return types, tagged errors); Effect IS the contract, not a hidden runtime detail",
    },
    {
      package: "@effect/platform",
      reason:
        "FileSystem and Path are typed services in every public Effect return; the @effect/platform service tags are part of the contract callers wire up",
    },
    {
      package: "@effect/cli",
      reason:
        "the CLI binary entry composes @effect/cli Command values; subcommands are values, not hidden types",
    },
  ],
  layers: [
    {
      name: "entrypoint",
      folders: ["cli"],
      reason:
        "CLI binary composition root; consumes codemod modes and translates exit codes",
    },
    {
      name: "modes",
      folders: ["codemod"],
      reason:
        "mode entrypoints (generate, validate, init, doctor, migrate, explain); compose pipeline stages",
    },
    {
      name: "pipeline",
      folders: ["pipeline"],
      reason:
        "codemod pipeline stages (applicability, link-resolver, reporter, section-emitter); consume detection output + kernel",
    },
    {
      name: "detection",
      folders: ["detection"],
      reason:
        "source-input parsers (kind-detector, jsdoc-parser); emit primitive detection vocabulary the pipeline consumes",
    },
    {
      name: "kernel",
      folders: ["errors", "kernel"],
      reason:
        "tagged-error registry plus shared types and schemas (kinds, types, version, sidecar, frontmatter, helper); imported by every layer",
    },
  ],
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

  // Application source: recommended + strict + architecture, all promoted to error.
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
      ...injectArchitectureOptions(
        promoteWarnToError(guard.configs.strict.rules),
        ARCHITECTURE_OPTIONS,
      ),
      ...injectArchitectureOptions(
        promoteWarnToError(guard.configs.architecture.rules),
        ARCHITECTURE_OPTIONS,
      ),
    },
  },

  // Tests: strict + integration-test, all promoted to error.
  //
  // sonarjs/no-empty-test-file is held off in the test block because the
  // codemod's `itSpec.todo(id, meta)` wrapper (see src/helper.ts) collects N
  // todo tests at Vitest runtime that sonarjs's static check cannot trace
  // through. The wrapper indirection is structural to the codemod's design
  // (kind-detector reads property metadata from call args via ts-morph, not
  // from Vitest's task object), so the static rule has nothing to assert on.
  // Re-evaluate when sonarjs adds wrapper-aware empty-test detection.
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
    settings: {
      ...guard.configs.strict.settings,
      "agent-code-guard": ARCHITECTURE_OPTIONS,
    },
    rules: {
      ...injectArchitectureOptions(
        promoteWarnToError(guard.configs.strict.rules),
        ARCHITECTURE_OPTIONS,
      ),
      ...injectArchitectureOptions(
        promoteWarnToError(guard.configs.integrationTests.rules),
        ARCHITECTURE_OPTIONS,
      ),
      "sonarjs/no-empty-test-file": "off",
    },
  },
];
