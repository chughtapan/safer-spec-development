# `kernel/` — shared vocabulary

Shared types, schemas, and the author-facing test helper that every layer
reaches for. The kernel is the deepest layer in the package's dependency
graph; no other folder depends on anything outside `kernel/` or `errors/`,
and nothing in the kernel imports out of it.

| File             | Surface                                                                                       |
|------------------|-----------------------------------------------------------------------------------------------|
| `version.ts`     | `SPEC_FORMAT_VERSION` constant (bumped on breaking format changes)                            |
| `kinds.ts`       | Closed `Kind` enum (the 9 statistically-significant OOPSLA 2025 property kinds)               |
| `types.ts`       | Public option types for the codemod modes (`GenerateOptions`, `ValidateOptions`, …)           |
| `sidecar.ts`     | Sidecar JSON contract (`SpecArtifact`, `SpecExportEntry` types + `decode/encodeSpecArtifact`) |
| `frontmatter.ts` | SPEC.md frontmatter contract (`SpecFrontmatter` type + `decode/encodeSpecFrontmatter`)        |
| `helper.ts`      | Author-facing test helper (`itSpec.todo`, `itSpec.prop`)                                      |
| `index.ts`       | Kernel facade — single import surface for all of the above                                    |

## Boundary discipline

Schema constructors stay private to their owning files (`sidecar.ts`,
`frontmatter.ts`). The public boundary is the `decode*` / `encode*` pair —
unknown input goes in, the typed value comes out (or a `ParseResult.ParseError`
on the error channel). Callers do not see the underlying `Schema.Struct`
constructors; only the derived types and boundary functions.

This matches `eslint-plugin-agent-code-guard/no-exported-brand-constructor`:
schema constructors are private; consumers consume types + boundaries.
