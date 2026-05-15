# `commands/` — binary + @effect/cli Commands

The `safer-spec` binary plus the four @effect/cli `Command` values it
composes, plus the format-version constant. Each command file declares
one command's input/output contract and owns the tagged errors it can
emit. `index.ts` is the binary entrypoint that wires them together and
translates typed failures into process exit codes.

| File          | Public surface                                                                     | Tagged error(s)                                                                  |
|---------------|------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| `index.ts`    | binary; wires the four commands; translates errors to exit codes                   | `CliExitCode`, `CliUsageError`                                                   |
| `generate.ts` | `generate`                                                                          | `GenerateError`                                                                  |
| `validate.ts` | `validate`, `formatDiagnostic`, `VALIDATE_GAP_EXIT_CODES`                           | `MissingSpecPropertyError`, `MissingStubError`, `MissingImplError`               |
| `doctor.ts`   | `doctor`                                                                            | `DoctorError`                                                                    |
| `explain.ts`  | `explain`                                                                           | `ExplainError`                                                                   |
| `version.ts`  | `SPEC_FORMAT_VERSION` (constant)                                                    | —                                                                                |

The binary at `index.ts` is the only consumer of the four command files;
they are not re-exported through the library facade (`src/index.ts`).

`init` and `migrate` are NOT CLI commands. They live as coding-agent
skill docs at the repo root under [`skills/safer-spec-init/SKILL.md`](../../skills/safer-spec-init/SKILL.md)
and [`skills/safer-spec-migrate/SKILL.md`](../../skills/safer-spec-migrate/SKILL.md).
A regex / ts-morph picker for "first runtime-named export" reliably
handles only the simple barrel shapes; the agent does the harder ones
(comments, namespaces, generators, type-only re-exports, etc.) by
reading TypeScript directly. Same logic for `migrate` — the diff
between format versions is regenerate-then-review, not a versioned
codegen table.

## Validate's gap-class errors

`validate --implemented` performs four cross-checks and emits one of
three tagged errors on failure. Each error maps to a POSIX exit code
via `VALIDATE_GAP_EXIT_CODES`, the satisfies-typed single source of
truth in `validate.ts`:

| Error                       | Exit code | Triggered by                                                 |
|-----------------------------|-----------|--------------------------------------------------------------|
| `MissingSpecPropertyError`  | 11        | JSDoc/runtime mismatch OR Properties-table drift             |
| `MissingStubError`          | 12        | Properties row with no colocated `itSpec.todo`/`itSpec.prop` |
| `MissingImplError`          | 13        | `itSpec.prop` body left empty after promotion                |

`index.ts` combines these with its own `CliUsageError → 2` (POSIX
convention) into a single `CLI_EXIT_CODES` map and uses
`Effect.catchAll` to derive the exit code from `e._tag`.
