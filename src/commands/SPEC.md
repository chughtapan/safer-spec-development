---
folder: src/commands
format-version: 0.1.0
generatedAtSha: a40dbc77aff41300877dba5635fd6de5c9cfbe45
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0.5555555555555556
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0.4
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

### [`CliExitCode`](./index.ts#L46)

```ts
export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> { /* ... */ }
```

### [`CliUsageError`](./index.ts#L50)

```ts
export class CliUsageError extends Data.TaggedError("CliUsageError")<{
  readonly subcommand: string;
  readonly reason: string;
}> { /* ... */ }
```

## Children

- [`doctor.ts`](./doctor.ts) — \`doctor\` command entrypoint. Health check of configs, deps, sidecar dir, format-version compatibility. Surfaces config drift and version skew before the user hits cryptic gate failures.  Tagged error \`DoctorError\` is co-located here.
- [`explain.ts`](./explain.ts) — \`explain\` command entrypoint. Looks up an error code (e.g. \`MISSING\_SPEC\_PROPERTY\`, \`spec-property-type-coverage\`) and returns the corresponding \`docs/errors.md\` entry.  Tagged error \`ExplainError\` is co-located here.
- [`generate.ts`](./generate.ts) — \`generate\` command entrypoint. Walks folders (one or all under cwd), calls \`analysis.generateFolder\` per folder, and writes the returned artifacts to disk (or logs them under \`--dry-run\`). Per-folder analysis pipeline lives entirely in \`@safer/analysis/\`; this file owns the cli boundary (folder discovery, I/O policy, tagged-error mapping).
- [`index.ts`](./index.ts) — CLI binary. Composes the four subcommands (\`generate\`, \`validate\`, \`doctor\`, \`explain\`) into the top-level \`safer-spec\` Command, then translates each tagged failure into \`process.exit(N)\` at the runtime boundary.  \`init\` and \`migrate\` are intentionally NOT CLI commands. Both are project-lifecycle flows that depend on judgment a regex / ts-morph resolver can't make reliably (which export to bind the stub to; which format-version diffs need human review). They ship as coding-agent skills (\`skills/safer-spec-init/SKILL.md\`, \`skills/safer-spec-migrate/SKILL.md\`) — the agent reads the existing barrel + spec format, scaffolds the right shape, and leaves the diff for human review.  Exit-code mapping at this boundary: - \`MissingSpecPropertyError\` → exit 11 - \`MissingStubError\`         → exit 12 - \`MissingImplError\`         → exit 13 - \`CliUsageError\`            → exit 2 (POSIX usage convention) - any other defect / failure → \`NodeRuntime.runMain\` default (non-zero)  Tagged errors \`CliExitCode\` and \`CliUsageError\` are co-located here.
- [`validate.ts`](./validate.ts) — \`validate\` command entrypoint. Walks each folder under cwd (or a single folder under \`--folder X\`), calls \`analysis.validateFolder\` per folder, and maps the first \`ValidateGapError\` to a POSIX exit code at the cli boundary. Per-folder pipeline orchestration lives entirely in \`@safer/analysis/\`; this file owns folder discovery, project-context loading, and the stderr diagnostic formatter.  \`--planned\`: regenerate SPEC.md + sidecar, diff on-disk; enforce per-folder coverage thresholds; per-test directive completeness is enforced via \`extractProperties\` issues + the diff check.  \`--implemented\`: planned-mode checks plus every \`itSpec.prop\` body is non-empty (no \`itSpec.todo\` placeholder).
- [`__tests__/cli.spec.test.ts`](./__tests__/cli.spec.test.ts) — Property stubs for the CLI surface. The \`validate\` subcommand exits with one of {0, 11, 12, 13, 1} according to the gap-class map plus the folder-not-found code. CLI flag-parsing guards live in \`commands/index.ts\`; these properties exercise the \`validate\` and \`generate\` exports directly.
- [`__tests__/sweep.spec.test.ts`](./__tests__/sweep.spec.test.ts) — Coverage-sweep tests for \`commands/\` — adds property types beyond \`tagged-errors.spec.test.ts\` for the two tagged errors \`CliExitCode\` and \`CliUsageError\` so each crosses the gate threshold.
- [`__tests__/tagged-errors.spec.test.ts`](./__tests__/tagged-errors.spec.test.ts) — Property tests for the tagged errors \`commands/index.ts\` publishes. \`CliExitCode\` carries the POSIX exit code the binary yields; \`CliUsageError\` carries a subcommand + reason for the \`validate --planned --implemented\` style mutually-exclusive flags path. Both are constructed via Effect's \`Data.TaggedError\` factory and consumed by \`Effect.catchTag\` at the runtime boundary.
- [`__tests__/validate-drift.spec.test.ts`](./__tests__/validate-drift.spec.test.ts) — Drift-gate and worktree-resolution properties for \`validate\`. Splits out of \`validate.spec.test.ts\` to keep each file under the strict line cap; both files cover the \`validate\` export.  Heavy ts-morph + filesystem work runs once at module load via top-level await; the fc property body asserts on the cached results.
- [`__tests__/validate.spec.test.ts`](./__tests__/validate.spec.test.ts) — Property stubs for the \`validate\` command entrypoint. Validate enforces four cross-checks: JSDoc directives exist on every itSpec call, JSDoc values match runtime metadata, committed SPEC.md equals regenerated output, and every implemented property has a non-empty body.  Each test memoizes its heavy I/O once at module load (fc runs the test body 100×; without memoization the project walks would time out). Drift-gate properties live in \`validate-drift.spec.test.ts\`.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `cli-validate-rejects-conflicting-flags` | `Exception Raising` | `validate` | --planned and --implemented passed together fail with CliUsageError exit code 2 | implemented |
| `cli-validate-exit-code-contract` | `Exception Raising` | `validate` | every validate failure tag maps to a non-zero POSIX exit in {1, 11, 12, 13} | implemented |
| `cli-folder-not-found-exit-code-is-one` | `Constant Equality` | `validate` | \`FOLDER\_NOT\_FOUND\_EXIT\_CODE === 1\` — the POSIX convention for "no resources matched" | implemented |
| `generate-folderless-discovers-every-index-folder` | `Inclusion` | `generate` | every folder in \`ctx.folders\` actually contains an \`index.ts\` — the precomputed snapshot's discover invariant; generate (no \`--folder\`) iterates this exact list | implemented |
| `folder-input-canonicalized-before-stamping` | `Constant Equality` | `generate` | authoring conveniences (\`./src/\`, trailing slashes, absolute paths) resolve to the same canonical folder string via \`ctx.resolveFolder\` — the SPEC.md frontmatter and sidecar slug never diverge for the same logical folder | implemented |
| `root-folder-uses-root-sidecar-slug` | `Constant Equality` | `generate` | \`sidecarSlug(".")\` is the literal \`"root"\` — the documented slug for the project root sentinel folder; generate, validate, and the sidecar-writer all agree on this slug | implemented |
| `validate-diagnostics-route-to-stderr` | `Constant Equality` | `validate` | \`safer-spec validate --folder X\` for an unresolved X yields a \`FolderNotFoundError\` whose body the cli writes to stderr; the gap-class diagnostics route the same way via \`formatDiagnostic\` | implemented |
| `cli-exit-code-bounded-by-posix-range` | `Constant Bounds Checking` | `CliExitCode` | \`CliExitCode.code\` accepts any number in \`\[0, 255\]\` — the POSIX exit-code range; values outside this range get truncated by the OS at \`process.exit(code)\` time | implemented |
| `cli-exit-code-non-equal-codes` | `Constant Non-Equality` | `CliExitCode` | two \`CliExitCode\` instances with different \`code\` values expose different \`code\` fields — no payload aliasing across instances | implemented |
| `cli-exit-code-typecheck` | `Typechecking` | `CliExitCode` | \`CliExitCode\` instances extend \`Error\` and expose \`code\` as a \`number\` — the runtime shape \`process.exit(e.code)\` consumes at the cli boundary | implemented |
| `cli-usage-error-typecheck` | `Typechecking` | `CliUsageError` | \`CliUsageError\` instances extend \`Error\` and expose \`subcommand\` + \`reason\` strings — the runtime shape the cli's stderr renderer concatenates | implemented |
| `cli-usage-error-non-equal-payloads` | `Constant Non-Equality` | `CliUsageError` | two \`CliUsageError\` instances with different \`reason\` strings expose different \`reason\` fields — no payload aliasing | implemented |
| `cli-usage-error-bounded-payload-types` | `Constant Bounds Checking` | `CliUsageError` | both payload fields stay strings even when constructed with empty input — \`Data.TaggedError\` doesn't coerce or default | implemented |
| `cli-usage-error-is-throwable` | `Exception Raising` | `CliUsageError` | \`CliUsageError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` — the surface the cli's exit-2 path catches at the \`@effect/cli\` composition root | implemented |
| `cli-exit-code-roundtrips-payload` | `Constant Equality` | `CliExitCode` | a \`CliExitCode\` constructed with \`{ code }\` exposes the same \`code\` value back through the public field — Data.TaggedError preserves the payload byte-for-byte | implemented |
| `cli-exit-code-tag-stable` | `Constant Equality` | `CliExitCode` | every \`CliExitCode\` instance carries \`\_tag: "CliExitCode"\` — the discriminant \`Effect.catchTag\` keys on at the runtime boundary | implemented |
| `cli-exit-code-is-throwable` | `Exception Raising` | `CliExitCode` | \`CliExitCode\` is an Error subclass and can be raised through \`Effect.fail\` → unwound by \`Effect.catchTag\` without losing its tag or payload | implemented |
| `cli-usage-error-roundtrips-payload` | `Constant Equality` | `CliUsageError` | a \`CliUsageError\` constructed with \`{ subcommand, reason }\` exposes both fields back through their public names | implemented |
| `cli-usage-error-tag-stable` | `Typechecking` | `CliUsageError` | \`CliUsageError.\_tag === "CliUsageError"\` — distinct from \`CliExitCode\`'s tag so catchTag routes to the right exit-code branch | implemented |
| `validate-flags-misplaced-per-export-directive` | `Exception Raising` | `validate` | a per-export directive (\`@spec.assume\`/\`@spec.guarantee\`/\`@spec.residual-contract\`/\`@spec.skip\`) placed in file-level JSDoc, or naming a symbol the folder doesn't export, fails as MissingSpecPropertyError with exit code 11 | implemented |
| `validate-drift-gate-uses-folder-wide-export-set` | `Constant Equality` | `validate` | directives that reference internal helpers (exported by a non-barrel source file in the folder) validate successfully; the drift gate's known-exports set is the union of every local source file's exports, not the barrel only | implemented |
| `validate-drift-ignores-external-source-directives` | `Constant Equality` | `validate` | a barrel re-exporting a subset of symbols from a sibling-folder source file validates without flagging the source file's other (unrelated) per-export directives as drift; drift checks scope to local sources only | implemented |
| `validate-records-git-worktree-head-sha` | `Constant Equality` | `validate` | when run from a git worktree (\`.git\` is a file with a \`gitdir:\` pointer, not a directory), \`generatedAtSha\` resolves to the actual HEAD SHA via the pointer, not \`uncommitted\` | implemented |
| `validate-gate-determ` | `Roundtrip` | `validate` | two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha | implemented |
| `validate-rejects-unresolved-folder` | `Exception Raising` | `validate` | \`validate --folder X\` for a folder X not in the discovered list fails with \`FolderNotFoundError\` carrying the user's requested string — the cli's exit-1 path | implemented |
| `validate-gap-exit-codes-cover-three-tags` | `Typechecking` | `validate`, `formatDiagnostic` | \`VALIDATE\_GAP\_EXIT\_CODES\` maps each of the three gap-class tags to an exit code in {11, 12, 13} — the cli's exit-code contract | implemented |
| `properties-table-self-host` | `Inclusion` | `validate` | the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc | implemented |
| `properties-table-self-host-bodied` | `Inclusion` | `validate` | every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body) | implemented |
