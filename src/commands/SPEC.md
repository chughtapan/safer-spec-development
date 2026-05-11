---
folder: src/commands
format-version: 0.1.0
generatedAtSha: 30b2a6302da467196c63d3c38b1c00445b043e00
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas:
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

### [`CliExitCode`](/src/commands/index.ts#L37)

```ts
export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> { /* ... */ }
```

### [`CliUsageError`](/src/commands/index.ts#L41)

```ts
export class CliUsageError extends Data.TaggedError("CliUsageError")<{
  readonly subcommand: string;
  readonly reason: string;
}> { /* ... */ }
```

## Files

- `src/commands/__tests__/cli.spec.test.ts`
- `src/commands/__tests__/validate.spec.test.ts`
- `src/commands/doctor.ts`
- `src/commands/explain.ts`
- `src/commands/generate.ts`
- `src/commands/index.ts`
- `src/commands/init.ts`
- `src/commands/migrate.ts`
- `src/commands/project-context.ts`
- `src/commands/validate-checks.ts`
- `src/commands/validate-pipeline.ts`
- `src/commands/validate.ts`
- `src/commands/version.ts`

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
