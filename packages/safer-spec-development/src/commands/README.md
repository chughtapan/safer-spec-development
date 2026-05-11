# `modes/` — codemod mode entries

The codemod's six mode entries plus the format-version constant. Each mode
file declares one mode's input/output contract and owns the tagged errors
it can emit.

| File          | Mode entry        | Tagged error(s)                                                                  |
|---------------|-------------------|----------------------------------------------------------------------------------|
| `generate.ts` | `generate`        | `GenerateError`                                                                  |
| `validate.ts` | `validate`, `formatDiagnostic`, `VALIDATE_GAP_EXIT_CODES` | `MissingSpecPropertyError`, `MissingStubError`, `MissingImplError` (one per gap class) |
| `init.ts`     | `init`            | `InitError`                                                                      |
| `doctor.ts`   | `doctor`          | `DoctorError`                                                                    |
| `migrate.ts`  | `migrate`         | `MigrateError`                                                                   |
| `explain.ts`  | `explain`         | `ExplainError`                                                                   |
| `version.ts`  | `SPEC_FORMAT_VERSION` (constant) | —                                                                  |

The CLI binary (`cli/index.ts`) is the only consumer outside this folder
that touches mode entries directly. The library facade (`src/index.ts`)
intentionally does NOT re-export modes — programmatic library consumers
have no current use case; the binary is the integration point.

## Validate's gap-class errors

`validate --implemented` performs four cross-checks and emits one of three
tagged errors on failure. Each error maps to a POSIX exit code via
`VALIDATE_GAP_EXIT_CODES`, the satisfies-typed single source of truth:

| Error                       | Exit code | Triggered by                                              |
|-----------------------------|-----------|-----------------------------------------------------------|
| `MissingSpecPropertyError`  | 11        | JSDoc/runtime mismatch OR Properties-table drift          |
| `MissingStubError`          | 12        | Properties row with no colocated `itSpec.todo`/`itSpec.prop` |
| `MissingImplError`          | 13        | `itSpec.prop` body left empty after promotion             |
