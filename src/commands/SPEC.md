---
folder: src/commands
format-version: 0.1.0
generatedAtSha: abec36933a44d10cf312b4bd009469306004e297
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0
  classifierCoverage: 0
  preconditionPassRate: 0
---

# SPEC

## Purpose

CLI binary. Composes the six subcommands (`init`, `generate`, `validate`, `doctor`, `explain`, `migrate`) into the top-level `safer-spec` Command, then translates each tagged failure into `process.exit(N)` at the runtime boundary.

Exit-code mapping at this boundary:
- `MissingSpecPropertyError` → exit 11
- `MissingStubError`         → exit 12
- `MissingImplError`         → exit 13
- `CliUsageError`            → exit 2 (POSIX usage convention)
- any other defect / failure → `NodeRuntime.runMain` default (non-zero)

Tagged errors `CliExitCode` and `CliUsageError` are co-located here.

## Public surface

### [`CliExitCode`](./index.ts#L35)

```ts
export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> { /* ... */ }
```

### [`CliUsageError`](./index.ts#L39)

```ts
export class CliUsageError extends Data.TaggedError("CliUsageError")<{
  readonly subcommand: string;
  readonly reason: string;
}> { /* ... */ }
```

## Children

- [`doctor.ts`](./doctor.ts) — \`doctor\` command entrypoint. Health check of configs, deps, sidecar dir, format-version compatibility. Surfaces config drift and version skew before the user hits cryptic gate failures.  Tagged error \`DoctorError\` is co-located here.
- [`explain.ts`](./explain.ts) — \`explain\` command entrypoint. Looks up an error code (e.g. \`MISSING\_SPEC\_PROPERTY\`, \`spec-property-type-coverage\`) and returns the corresponding \`docs/errors.md\` entry.  Tagged error \`ExplainError\` is co-located here.
- [`folder-discovery.ts`](./folder-discovery.ts) — Folder-discovery helpers used by \`generate\` and \`validate\`: recursive walk for the no-\`--folder\` mode (\`discoverFolders\`), immediate-children walk for the parent SPEC.md's \`## Children\` section (\`discoverImmediateSubfolders\`), and the \`buildChildren\` helper that composes the merged file + subfolder list emit consumes. Extracted from \`validate-pipeline.ts\` so each file fits the strict max-lines cap.
- [`generate.ts`](./generate.ts) — \`generate\` command entrypoint. Walks one folder under \`--folder X\`, parses \`@spec\*\` JSDoc directives, extracts \`itSpec.\*\` call sites + JSDoc from \`\*.spec.test.ts\`, composes a \`FolderAnalysis\`, and emits one \`SPEC.md\` plus one \`.safer-spec/&lt;slug&gt;.json\` sidecar. Tagged errors \`GenerateError\` and \`GenerateIOError\` are co-located.
- [`index.ts`](./index.ts) — CLI binary. Composes the six subcommands (\`init\`, \`generate\`, \`validate\`, \`doctor\`, \`explain\`, \`migrate\`) into the top-level \`safer-spec\` Command, then translates each tagged failure into \`process.exit(N)\` at the runtime boundary.  Exit-code mapping at this boundary: - \`MissingSpecPropertyError\` → exit 11 - \`MissingStubError\`         → exit 12 - \`MissingImplError\`         → exit 13 - \`CliUsageError\`            → exit 2 (POSIX usage convention) - any other defect / failure → \`NodeRuntime.runMain\` default (non-zero)  Tagged errors \`CliExitCode\` and \`CliUsageError\` are co-located here.
- [`init.ts`](./init.ts) — \`init\` command entrypoint. Scaffolds first SPEC.md + stub \`\*.spec.test.ts\` + \`safer-spec.config.{ts,json}\` in a fresh repo. Picks a leaf folder with \`index.ts\` if no folder given. Lenient starter thresholds. Targets TTHW &lt;10 minutes.  Tagged error \`InitError\` is co-located here.
- [`migrate.ts`](./migrate.ts) — \`migrate\` command entrypoint. Walks SPEC.md + config files for format-version transitions; emits a diff for human review; idempotent. Format-version bumps are signposted in CHANGELOG before migration support changes.  Tagged error \`MigrateError\` is co-located here.
- [`project-context.ts`](./project-context.ts) — Project-wide loader for the codemod. Walks the project tree for every non-test \`.ts\` source, reads the tsconfig \`paths\` map, and reads the current git HEAD SHA. \`collectExports\` consumes the sources + paths so barrel re-exports across files and aliases resolve; emit needs the SHA for SpecFrontmatter and SpecArtifact metadata.  Tagged error \`ProjectContextError\` is co-located here.
- [`validate-checks.ts`](./validate-checks.ts) — Validate's gap-class cross-checks. Co-locates the four tagged errors (MissingSpecPropertyError, MissingStubError, MissingImplError, NoFoldersResolvedError) with the check effects that emit them and the diagnostic-builder helpers that shape their bodies.  Extracted from \`validate.ts\` to keep the orchestration file under the strict max-lines cap; the public surface still routes through \`validate.ts\` (this module is internal to the commands layer).
- [`validate-pipeline.ts`](./validate-pipeline.ts) — Shared analysis pipeline for \`validate\`. Walks the same inputs as \`generate\` (sources, tests, index barrel) and returns the \`FolderAnalysis\` that the markdown emitter consumes plus the per-test issues list (\`ItSpecIssue\[\]\`) that \`validate.ts\` maps to its gap-class exit codes.
- [`validate.ts`](./validate.ts) — \`validate\` command entrypoint. Walks each folder that has an \`index.ts\` barrel, runs the same analysis pipeline as \`generate\`, diffs the regenerated SPEC.md + sidecar against the on-disk artifacts, enforces coverage thresholds, and reports gap-class failures via tagged errors mapped to POSIX exit codes {1, 11, 12, 13}.  \`commands/index.ts\` translates each tag at the runtime boundary. The per-check effects and their tagged errors live in \`commands/validate-checks.ts\`; the shared analysis pipeline (folder walking, directive parsing, sidecar regeneration, threshold lookup) lives in \`commands/validate-pipeline.ts\`. This file is orchestration only.  \`--planned\`: regenerate SPEC.md + sidecar, diff on-disk; enforce per-folder coverage thresholds; per-test directive completeness is enforced via \`extractProperties\` issues + the diff check.  \`--implemented\`: planned-mode checks plus every \`itSpec.prop\` body is non-empty (no \`itSpec.todo\` placeholder).  Diagnostics carry a problem / cause / fix / docsLink quartet so agents can route the next remediation step.
- [`version.ts`](./version.ts) — Format version constant for SPEC.md frontmatter and the \`.safer-spec/&lt;folder&gt;.json\` sidecar JSON. Co-located with the commands because \`migrate.ts\` bumps it during format-version transitions and \`generate.ts\` stamps it onto every emitted SPEC.md.
- [`__tests__/cli.spec.test.ts`](./__tests__/cli.spec.test.ts) — Property stubs for the CLI surface. Exception Raising: the CLI rejects invalid flag combos with a structured \`CliUsageError\`. The \`validate\` subcommand exits with one of {0, 11, 12, 13} according to the validate gap-class map.  The CLI subcommand handlers are inlined in \`commands/index.ts\`; properties reference the \`validate\` command as the export under test.
- [`__tests__/validate.spec.test.ts`](./__tests__/validate.spec.test.ts) — Property stubs for the \`validate\` command entrypoint. Validate enforces four cross-checks: JSDoc directives exist on every itSpec call, JSDoc values match runtime metadata, committed SPEC.md equals regenerated output, and every implemented property has a non-empty body.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `cli-validate-rejects-conflicting-flags` | `Exception Raising` | `validate` | --planned and --implemented passed together fail with CliUsageError exit code 2 | todo |
| `cli-validate-exit-code-contract` | `Exception Raising` | `validate` | ValidateGapError tags propagate to process.exit(N) with N in {11, 12, 13} | todo |
| `validate-gate-determ` | `Roundtrip` | `validate` | two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha | todo |
| `validate-emits-gap-cls` | `Exception Raising` | `validate` | every gate failure emits a typed ValidateError with gapClass in {11, 12, 13} | todo |
| `validate-diagnostic-shape` | `Typechecking` | `validate`, `formatDiagnostic` | every emitted diagnostic conforms to {problem, cause, fix, docsLink} | todo |
| `properties-table-self-host` | `Inclusion` | `validate` | the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc | todo |
| `properties-table-self-host-bodied` | `Inclusion` | `validate` | every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body) | todo |
