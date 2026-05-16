import guard from "eslint-plugin-agent-code-guard";
import importPlugin from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";

// Severity promotion: `warn` rules in this repo are architectural drift
// signals. Promoting warn to error at the config level keeps the gate inside
// the config, not at the CLI flag, so the gate is the same in every
// environment that loads the config.
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
// The 11 dotted `@spec.*` directive tags the codemod's grammar uses. ACG
// 0.0.13 turns on `jsdoc/check-tag-names`, which rejects anything not in its
// built-in whitelist. The tags are the codemod's contract surface (parsed
// by `src/spec/directives/`); register them as defined.
const SPEC_DIRECTIVE_TAGS = [
  "spec.purpose",
  "spec.ignore",
  "spec.assume",
  "spec.guarantee",
  "spec.residual-contract",
  "spec.skip",
  "spec.ignore-export",
  "spec.property",
  "spec.type",
  "spec.exports",
  "spec.claim",
];

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
    {
      package: "@effect/platform-node",
      reason:
        "the SaferSpecExecutionReporter class composes NodeContext.layer at its Vitest boundary; Vitest invokes the reporter outside the codemod's CLI composition root, so the reporter owns its node runtime — this is the only public surface that legitimately mentions @effect/platform-node",
    },
  ],
  layers: [
    {
      name: "commands",
      folders: ["commands"],
      reason:
        "the four @effect/cli Command entries (generate, validate, doctor, explain) plus the binary composition root (index.ts); init/migrate ship as coding-agent skills, not CLI code",
    },
    {
      name: "project",
      folders: ["project"],
      reason:
        "project-wide setup — context loader, config schema/loader, format-version constant, folder-walking helpers. Commands and analysis read this to know WHICH project they're working on and WHICH thresholds gate it",
    },
    {
      name: "analysis",
      folders: ["analysis"],
      reason:
        "how commands actually ingest the project: ts-morph export collection, JSDoc + itSpec extraction, the shared analysis pipeline driving generate + validate, and the gap-class cross-checks. Reads spec/ types; consumed by commands/",
    },
    {
      name: "domain",
      folders: ["spec"],
      reason:
        "the spec format itself. spec/artifact/ owns the on-disk artifacts (SPEC.md emitter, frontmatter and sidecar parse+emit, atomic writer, helpers, Vitest reporter). spec/grammar/ owns the @spec.* directive language plus the closed PropertyType vocabulary plus the itSpec runtime (the directive grammar's runtime encoding). Commands and analysis orchestrate this domain",
    },
  ],
  packageRuntime: "node",
  // Per-folder caps. The refactor pulled `commands/` from 11 mixed
  // files down to 5 commands-and-binary; `project/` and `analysis/`
  // are the new layers; `spec/` is now a thin barrel + two semantic
  // subfolders (artifact/ + grammar/).
  folderChildCountOverrides: [
    {
      folder: "commands",
      maxChildren: 6,
      maxChildrenIncludingTests: 10,
      maxUnpairedTestChildren: 10,
      reason:
        "commands/ holds the four @effect/cli Command entrypoints (generate, validate, doctor, explain) plus index.ts (CLI composition root). Each operation file fronts a single command; shared setup lives in project/, shared analysis in analysis/, and the spec format in spec/",
    },
    {
      folder: "project",
      maxChildren: 6,
      maxChildrenIncludingTests: 10,
      maxUnpairedTestChildren: 10,
      reason:
        "project/ holds the project-wide setup: context.ts (sources/paths/SHA/config loader), config.ts (safer-spec.config.json schema + loader + per-folder threshold resolver), version.ts (format-version constant), folders.ts (recursive + immediate folder walks). Each is a distinct project-setup concern",
    },
    {
      folder: "analysis",
      maxChildren: 6,
      maxChildrenIncludingTests: 10,
      maxUnpairedTestChildren: 10,
      reason:
        "analysis/ holds the project-reading + cross-check stack: pipeline.ts (the shared analysis driving generate + validate), checks.ts (validate's gap-class cross-checks + tagged errors), exports.ts (ts-morph export collector), properties.ts (itSpec call extractor). Each step in the read-then-check chain",
    },
    {
      folder: "spec",
      maxChildren: 4,
      maxChildrenIncludingTests: 8,
      maxUnpairedTestChildren: 8,
      reason:
        "spec/ collapses to a small barrel + two semantic subfolders. spec/index.ts re-exports the author surface for the package facade; spec/artifact/ owns SPEC.md + sidecar JSON + execution sidecar (parse+emit per-artifact, helpers, writer, reporter); spec/grammar/ owns the @spec.* directive language + PropertyType vocabulary + itSpec runtime",
    },
    {
      folder: "artifact",
      maxChildren: 8,
      maxChildrenIncludingTests: 16,
      maxUnpairedTestChildren: 16,
      reason:
        "spec/artifact/ holds the seven files that read and write the codemod's on-disk artifacts: emit.ts (SPEC.md producer), escape.ts (markdown/YAML/JSON escape helpers), frontmatter.ts (YAML frontmatter schema + parse + emit), link-resolver.ts (internal-link helper), sidecar.ts (canonical sidecar JSON schema + parse + emit), sidecar-writer.ts (atomic write), reporter.ts (Vitest reporter that writes the execution sidecar — the second artifact validate --implemented consumes)",
    },
    {
      folder: "grammar",
      maxChildren: 8,
      maxChildrenIncludingTests: 16,
      maxUnpairedTestChildren: 16,
      reason:
        "spec/grammar/ holds the @spec.* directive language plus its peers: directives.ts (parser barrel), shared.ts + file-level.ts + per-export.ts (directive impl), tsdoc-bridge.ts (TSDoc bridge), property-types.ts (the closed PropertyType taxonomy — vocabulary for @spec.type), it-spec.ts (the runtime form of per-export directive metadata that test authors call)",
    },
  ],
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
    files: ["src/**/*.ts"],
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
      // a domain term ("a property in todo state until the implementation
      // fills the body"). Replacing every reference would obscure the
      // contract the codemod's design depends on.
      "sonarjs/todo-tag": "off",
      "jsdoc/check-tag-names": ["error", { definedTags: SPEC_DIRECTIVE_TAGS }],
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
      "src/**/*.{test,spec}.ts",
      "test/**/*.ts",
      "tests/**/*.ts",
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
      "jsdoc/check-tag-names": ["error", { definedTags: SPEC_DIRECTIVE_TAGS }],
      "import/no-relative-parent-imports": "error",
      "import/no-relative-packages": "error",
    },
  },
];
