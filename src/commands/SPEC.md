---
folder: src/commands
format-version: 0.1.0
generatedAtSha: 4a84c8a158ef9e717ac64d92d72ea82c1daa7ccd
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

CLI binary. Composes the four subcommands (`generate`, `validate`, `doctor`, `explain`) into the top-level `safer-spec` Command, then translates each tagged failure into `process.exit(N)` at the runtime boundary.

`init` and `migrate` are intentionally NOT CLI commands. Both are project-lifecycle flows that depend on judgment a regex / ts-morph resolver can't make reliably (which export to bind the stub to; which format-version diffs need human review). They ship as coding-agent skills (`skills/safer-spec-init/SKILL.md`, `skills/safer-spec-migrate/SKILL.md`) — the agent reads the existing barrel + spec format, scaffolds the right shape, and leaves the diff for human review.

Exit-code mapping at this boundary:
- `MissingSpecPropertyError` → exit 11
- `MissingStubError`         → exit 12
- `MissingImplError`         → exit 13
- `CliUsageError`            → exit 2 (POSIX usage convention)
- any other defect / failure → `NodeRuntime.runMain` default (non-zero)

Tagged errors `CliExitCode` and `CliUsageError` are co-located here.

## Public surface

### [`CliExitCode`](./index.ts#L42)

```ts
export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> { /* ... */ }
```

### [`CliUsageError`](./index.ts#L46)

```ts
export class CliUsageError extends Data.TaggedError("CliUsageError")<{
  readonly subcommand: string;
  readonly reason: string;
}> { /* ... */ }
```

## Children

- [`doctor.ts`](./doctor.ts) — \`doctor\` command entrypoint. Health check of configs, deps, sidecar dir, format-version compatibility. Surfaces config drift and version skew before the user hits cryptic gate failures.  Tagged error \`DoctorError\` is co-located here.
- [`explain.ts`](./explain.ts) — \`explain\` command entrypoint. Looks up an error code (e.g. \`MISSING\_SPEC\_PROPERTY\`, \`spec-property-type-coverage\`) and returns the corresponding \`docs/errors.md\` entry.  Tagged error \`ExplainError\` is co-located here.
- [`generate.ts`](./generate.ts) — \`generate\` command entrypoint. Walks one folder under \`--folder X\`, parses \`@spec\*\` JSDoc directives, extracts \`itSpec.\*\` call sites + JSDoc from \`\*.spec.test.ts\`, composes a \`FolderAnalysis\`, and emits one \`SPEC.md\` plus one \`.safer-spec/&lt;slug&gt;.json\` sidecar. Tagged errors \`GenerateError\` and \`GenerateIOError\` are co-located.
- [`index.ts`](./index.ts) — CLI binary. Composes the four subcommands (\`generate\`, \`validate\`, \`doctor\`, \`explain\`) into the top-level \`safer-spec\` Command, then translates each tagged failure into \`process.exit(N)\` at the runtime boundary.  \`init\` and \`migrate\` are intentionally NOT CLI commands. Both are project-lifecycle flows that depend on judgment a regex / ts-morph resolver can't make reliably (which export to bind the stub to; which format-version diffs need human review). They ship as coding-agent skills (\`skills/safer-spec-init/SKILL.md\`, \`skills/safer-spec-migrate/SKILL.md\`) — the agent reads the existing barrel + spec format, scaffolds the right shape, and leaves the diff for human review.  Exit-code mapping at this boundary: - \`MissingSpecPropertyError\` → exit 11 - \`MissingStubError\`         → exit 12 - \`MissingImplError\`         → exit 13 - \`CliUsageError\`            → exit 2 (POSIX usage convention) - any other defect / failure → \`NodeRuntime.runMain\` default (non-zero)  Tagged errors \`CliExitCode\` and \`CliUsageError\` are co-located here.
- [`validate.ts`](./validate.ts) — \`validate\` command entrypoint. Walks each folder that has an \`index.ts\` barrel, runs the same analysis pipeline as \`generate\`, diffs the regenerated SPEC.md + sidecar against the on-disk artifacts, enforces coverage thresholds, and reports gap-class failures via tagged errors mapped to POSIX exit codes {1, 11, 12, 13}.  \`commands/index.ts\` translates each tag at the runtime boundary. The per-check effects and their tagged errors live in \`commands/validate-checks.ts\`; the shared analysis pipeline (folder walking, directive parsing, sidecar regeneration, threshold lookup) lives in \`commands/validate-pipeline.ts\`. This file is orchestration only.  \`--planned\`: regenerate SPEC.md + sidecar, diff on-disk; enforce per-folder coverage thresholds; per-test directive completeness is enforced via \`extractProperties\` issues + the diff check.  \`--implemented\`: planned-mode checks plus every \`itSpec.prop\` body is non-empty (no \`itSpec.todo\` placeholder).  Diagnostics carry a problem / cause / fix / docsLink quartet so agents can route the next remediation step.
- [`__tests__/cli.spec.test.ts`](./__tests__/cli.spec.test.ts) — Property stubs for the CLI surface. Exception Raising: the CLI rejects invalid flag combos with a structured \`CliUsageError\`. The \`validate\` subcommand exits with one of {0, 11, 12, 13} according to the validate gap-class map.  The CLI subcommand handlers are inlined in \`commands/index.ts\`; properties reference the \`validate\` command as the export under test.
- [`__tests__/validate-drift.spec.test.ts`](./__tests__/validate-drift.spec.test.ts) — Drift-gate and worktree-resolution properties for \`validate\`. Splits out of \`validate.spec.test.ts\` to keep each file under the strict line cap; both files cover the \`validate\` export.  Heavy ts-morph + filesystem work runs once at module load via top-level await; the fc property body asserts on the cached results.
- [`__tests__/validate.spec.test.ts`](./__tests__/validate.spec.test.ts) — Property stubs for the \`validate\` command entrypoint. Validate enforces four cross-checks: JSDoc directives exist on every itSpec call, JSDoc values match runtime metadata, committed SPEC.md equals regenerated output, and every implemented property has a non-empty body.  Each test memoizes its heavy I/O once at module load (fc runs the test body 100×; without memoization the project walks would time out). Drift-gate properties live in \`validate-drift.spec.test.ts\`.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `cli-validate-rejects-conflicting-flags` | `Exception Raising` | `validate` | --planned and --implemented passed together fail with CliUsageError exit code 2 | implemented |
| `cli-validate-exit-code-contract` | `Exception Raising` | `validate` | ValidateGapError tags propagate to process.exit(N) with N in {11, 12, 13} | implemented |
| `generate-folderless-discovers-every-index-folder` | `Inclusion` | `generate` | \`safer-spec generate --write\` (no --folder) writes a SPEC.md + sidecar to every directory under the project root that contains an index.ts barrel | implemented |
| `folder-input-canonicalized-before-stamping` | `Constant Equality` | `generate` | \`--folder $PWD/src\`, \`--folder ./src/\`, and \`--folder src//commands\` produce byte-identical SPEC.md and sidecar artifacts to their canonical cwd-relative forms | implemented |
| `root-folder-uses-root-sidecar-slug` | `Constant Equality` | `generate` | \`--folder .\` (project root) writes the sidecar to \`.safer-spec/root.json\`, never \`.safer-spec/.json\`; generate, validate, and the sidecar-writer all agree on the slug | implemented |
| `validate-diagnostics-route-to-stderr` | `Constant Equality` | `validate` | \`safer-spec validate\` failures write the diagnostic body to stderr; stdout stays empty so success-path stdout-piping scripts aren't polluted | implemented |
| `validate-flags-misplaced-per-export-directive` | `Exception Raising` | `validate` | a per-export directive (\`@spec.assume\`/\`@spec.guarantee\`/\`@spec.residual-contract\`/\`@spec.skip\`) placed in file-level JSDoc, or naming a symbol the folder doesn't export, fails as MissingSpecPropertyError with exit code 11 | implemented |
| `validate-drift-gate-uses-folder-wide-export-set` | `Constant Equality` | `validate` | directives that reference internal helpers (exported by a non-barrel source file in the folder) validate successfully; the drift gate's known-exports set is the union of every local source file's exports, not the barrel only | implemented |
| `validate-drift-ignores-external-source-directives` | `Constant Equality` | `validate` | a barrel re-exporting a subset of symbols from a sibling-folder source file validates without flagging the source file's other (unrelated) per-export directives as drift; drift checks scope to local sources only | implemented |
| `validate-records-git-worktree-head-sha` | `Constant Equality` | `validate` | when run from a git worktree (\`.git\` is a file with a \`gitdir:\` pointer, not a directory), \`generatedAtSha\` resolves to the actual HEAD SHA via the pointer, not \`uncommitted\` | implemented |
| `validate-gate-determ` | `Roundtrip` | `validate` | two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha | implemented |
| `validate-emits-gap-cls` | `Exception Raising` | `validate` | every gate failure emits a typed ValidateError with gapClass in {11, 12, 13} | implemented |
| `validate-diagnostic-shape` | `Typechecking` | `validate`, `formatDiagnostic` | every emitted diagnostic conforms to {problem, cause, fix, docsLink} | implemented |
| `properties-table-self-host` | `Inclusion` | `validate` | the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc | implemented |
| `properties-table-self-host-bodied` | `Inclusion` | `validate` | every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body) | implemented |
