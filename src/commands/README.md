# `commands/` — binary + @effect/cli Commands

The `safer-spec` binary plus the four @effect/cli `Command` values it
composes. Each command file declares one command's input/output
contract; `index.ts` is the binary entrypoint that wires them together
and translates typed failures into process exit codes.

Shared infrastructure lives elsewhere by job:
- Project-wide setup (`SPEC_FORMAT_VERSION`, project context loader,
  config schema, folder walks) → [`project/`](../project/)
- The analysis pipeline + gap-class cross-checks → [`analysis/`](../analysis/)
- Spec format definition + author runtime → [`spec/`](../spec/)

| File          | Public surface                                                | Tagged error(s)                       |
|---------------|---------------------------------------------------------------|---------------------------------------|
| `index.ts`    | binary; wires the four commands; translates errors to exit codes | `CliExitCode`, `CliUsageError`        |
| `generate.ts` | `generate`                                                    | `GenerateError`                       |
| `validate.ts` | `validate`, `formatDiagnostic`, `VALIDATE_GAP_EXIT_CODES`     | (gap-class errors live in `analysis/checks.ts`) |
| `doctor.ts`   | `doctor`                                                      | `DoctorError`                         |
| `explain.ts`  | `explain`                                                     | `ExplainError`                        |

The binary at `index.ts` is the only consumer of the other four command
files; they are not re-exported through the library facade.

`init` and `migrate` are NOT CLI commands. They live as coding-agent
skill docs at the repo root under
[`skills/safer-spec-init/SKILL.md`](../../skills/safer-spec-init/SKILL.md)
and [`skills/safer-spec-migrate/SKILL.md`](../../skills/safer-spec-migrate/SKILL.md).
A regex / ts-morph picker for "first runtime-named export" reliably
handles only the simple barrel shapes; the agent does the harder ones
(comments, namespaces, generators, type-only re-exports, etc.) by
reading TypeScript directly. Same logic for `migrate` — the diff
between format versions is regenerate-then-review, not a versioned
codegen table.

## Validate's gap-class errors

`validate --implemented` performs four cross-checks. Each failure
emits one of four typed errors (defined in
[`analysis/checks.ts`](../analysis/checks.ts)) that map to POSIX exit
codes via `VALIDATE_GAP_EXIT_CODES` in `validate.ts`:

| Error                       | Exit code | Triggered by                                                 |
|-----------------------------|-----------|--------------------------------------------------------------|
| `MissingSpecPropertyError`  | 11        | SPEC.md drift OR sidecar drift OR Properties-row directive mismatch |
| `MissingStubError`          | 12        | `itSpec` call site missing one of the required JSDoc directives |
| `MissingImplError`          | 13        | `itSpec.prop` body empty OR coverage metric below threshold OR execution sidecar stale/missing |
| `NoFoldersResolvedError`    | 1         | `--folder X` resolved to zero folders containing `index.ts`  |

`index.ts` combines these with its own `CliUsageError → 2` (POSIX
convention) into a single `CLI_EXIT_CODES` map and uses
`Effect.catchTag` per typed error to derive the exit code.
