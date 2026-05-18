# `spec/artifact/` — the on-disk files

Anything that reads, writes, or escapes content for the codemod's on-disk artifacts: `<folder>/MODULE.md` (markdown + YAML frontmatter) and `<folder>/.safer-spec/<slug>.json` (canonical sidecar) + `<slug>.execution.json` (Vitest reporter sidecar).

| File | Job |
|---|---|
| `emit.ts` | `emitMarkdown(analysis, meta)` — produces the canonical MODULE.md text from a `FolderAnalysis` + `SpecMeta`. Also: `computeTypeCoverage`, `findMissingPropertyTypes`, the `ExportEntry`/`PropertyRow`/`FolderAnalysis`/`SpecMeta` types. |
| `frontmatter.ts` | YAML frontmatter schema + parse + emit. Roundtrip pair stays together. |
| `sidecar.ts` | Canonical sidecar JSON schema + parse + emit (`buildSpecArtifact`, `serializeSidecar`, `SpecArtifact`). |
| `sidecar-writer.ts` | Atomic per-folder JSON writer for both canonical and execution sidecars. |
| `reporter.ts` | `SaferSpecExecutionReporter` — Vitest reporter class. Aggregates fast-check `RunDetails` per folder, computes preconditionPassRate / classifierCoverage, writes the per-folder execution sidecar consumed by `validate --implemented`. Exposed via the `./reporter` subpath export. |
| `escape.ts` | Markdown / YAML / JSON escape helpers, used by `emit.ts` and the frontmatter / sidecar emitters. |
| `link-resolver.ts` | Internal-link resolver (`relativeToFolder`, etc.) for the MODULE.md `## Children` section and inline references. |

Consumes `spec/grammar/` for directive types. Never reads project source — `analysis/` does that and hands a `FolderAnalysis` over to `emit.ts`.
