# `analysis/` — read the project + cross-check

How the commands actually ingest a project's source and run their gap-class cross-checks. Reads `spec/` for format types; consumed by `commands/`.

| File | Job |
|---|---|
| `pipeline.ts` | The shared analysis pipeline driving `generate` and `validate` — folder walking, directive parsing, sidecar regeneration, threshold lookup. `inspectFolder`, `buildSpecMeta`, `regenerateMarkdown`, `regenerateSidecar`, `loadExecutionSidecar`, `findThresholdShortfall`, etc. |
| `checks.ts` | `validate`'s gap-class cross-checks + their tagged errors: `MissingSpecPropertyError` (drift), `MissingStubError` (missing JSDoc directives), `MissingImplError` (empty body or threshold shortfall), `NoFoldersResolvedError`. Plus the check effects (`checkDrift`, `checkSidecarDrift`, `checkThresholds`, `checkImplBodies`, `checkExecutionSidecarPresent`). |
| `exports.ts` | `collectExports` — ts-morph-based TS source reader. Returns the per-folder list of exported declarations (name, kind, signature, source location). Resolves barrel re-exports across registered siblings. Type: `DeclaredExport`. |
| `properties.ts` | `extractProperties` — reads test files for `itSpec.todo`/`itSpec.prop` call sites, parses their JSDoc directives, returns the `PropertyRow` list the MODULE.md `## Properties` table renders. Type: `ItSpecIssue` for parse failures. |

The pipeline reads `exports`+`properties` to build a `FolderAnalysis`, then `buildSpecMeta` combines it with the project's `Thresholds` and any execution sidecar to produce `SpecMeta`. `commands/generate` and `commands/validate` orchestrate from here.
