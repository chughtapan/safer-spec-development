import guard from "eslint-plugin-agent-code-guard";
import importPlugin from "eslint-plugin-import";
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
//
// Domain decomposition: each domain owns its types, private schema
// constructors, and tagged errors. Errors stay with their producer modules,
// and shared types live in the domain that owns them.
const ARCHITECTURE_OPTIONS = {
  forbiddenSubpathSegments: [],
  implementationPathSegments: [],
  sharedFolderNames: [],
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
    {
      package: "fast-check",
      reason:
        "the itSpec.prop helper takes `fc.Arbitrary<T>` directly; fast-check IS the property-test runtime contract",
    },
  ],
  layers: [
    {
      name: "entrypoint",
      folders: ["cli"],
      reason:
        "CLI binary composition root; orchestrates modes and translates exit codes",
    },
    {
      name: "modes",
      folders: ["modes"],
      reason:
        "codemod mode entrypoints (generate, validate, init, doctor, migrate, explain); orchestrate the spec/source/sidecar peer domains",
    },
    {
      name: "domains",
      folders: ["spec", "source", "sidecar"],
      reason:
        "peer domains; each owns one knowledge area (SPEC.md artifact, TypeScript source analysis, sidecar JSON). They do not depend on each other; modes orchestrate them",
    },
    {
      name: "terminals",
      folders: ["kinds", "authoring"],
      reason:
        "no upward deps; kinds is the closed Kind enum, authoring is the itSpec helper",
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
    plugins: {
      ...guard.configs.strict.plugins,
      import: importPlugin,
    },
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
      // Path aliases are the package-internal contract; relative cross-domain
      // imports make refactors harder and obscure architectural boundaries.
      "import/no-relative-parent-imports": "error",
      "import/no-relative-packages": "error",
      // Globally off: this codebase wraps Vitest's `it.todo` and uses the
      // word "todo" throughout JSDoc to describe the placeholder state of
      // stubbed properties. The rule treats lowercase "todo" in comments
      // as a stale-task marker; here it is the cited Vitest API name and
      // a domain term ("a property in todo state until the implementer
      // fills the body"). Replacing every reference would obscure the
      // contract the codemod's design depends on.
      "sonarjs/todo-tag": "off",
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
    plugins: {
      ...guard.configs.strict.plugins,
      import: importPlugin,
    },
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
      "sonarjs/todo-tag": "off",
      "import/no-relative-parent-imports": "error",
      "import/no-relative-packages": "error",
    },
  },
];
