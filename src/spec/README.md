# `spec/` — codemod output artifact domain

Everything about the codemod's output lives here: directive grammar +
parser, escape helpers, markdown emitter + frontmatter, sidecar JSON
schema + writer. Markdown SPEC.md and `.safer-spec/<folder>.json` are
two serializations of the same data, so they share a domain.

| File                  | Role                                                                                  |
|-----------------------|---------------------------------------------------------------------------------------|
| `directives.ts`       | Closed JSDoc directive grammar (file-level, per-export, per-test populations) + parser. Tagged error `JsDocDirectiveOverflowError` co-located. |
| `escape.ts`           | `escapeForMarkdown` / `escapeForYaml` / `escapeForJson` + `enforceLengthCap`. Trust-boundary defense applied at both output formats. |
| `frontmatter.ts`      | Effect Schema for SPEC.md frontmatter (private constructor); `decodeSpecFrontmatter` boundary. |
| `emit.ts`             | Canonical SPEC.md markdown serializer.                                                |
| `sidecar.ts`          | Effect Schema for `.safer-spec/<folder>.json` (private constructor); `decodeSpecArtifact` boundary. Tagged error `SidecarSchemaError` co-located. |
| `sidecar-writer.ts`   | `serializeSidecar` + `writeSidecar`. Tagged error `SidecarWriteError` co-located.     |

## Why these files share a folder

Directives parsed from source drive BOTH the markdown emitter and the
sidecar JSON writer. Frontmatter and sidecar share escape helpers,
`PROPERTY_TYPES` references, and identical trust-boundary discipline.
Markdown is for humans; sidecar JSON is for tools. Same data, two
serializations.

## Directive grammar

`directives.ts` carries 11 directive types across three call-site
populations:

- File-level (on `index.ts` barrels): `@spec.purpose`, `@spec.ignore`.
- Per-export: `@spec.assume`, `@spec.guarantee`, `@spec.residual-contract`,
  `@spec.skip`, `@spec.ignore-export`.
- Per-test (above each `itSpec.prop`/`itSpec.todo` call): `@spec.property`,
  `@spec.type`, `@spec.exports`, `@spec.claim`.

`generate` walks BOTH source and test files; the `## Properties` table
is sourced from the test-side directives, other sections from
source-side directives.
