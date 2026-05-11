# `spec/` — SPEC.md artifact domain

Everything about the SPEC.md artifact lives here: directive grammar +
parser, frontmatter Schema + decode boundary, canonical emitter, and the
escape helpers that defuse residual-contract injection.

| File              | Role                                                                                  |
|-------------------|---------------------------------------------------------------------------------------|
| `directives.ts`   | Closed JSDoc directive grammar (file-level, per-export, per-test populations) + parser. Tagged errors `JsDocDirectiveParseError`, `JsDocDirectiveOverflowError`, `JsDocUnknownDirectiveError` co-located. |
| `escape.ts`       | `escapeForMarkdown` / `escapeForYaml` / `escapeForJson` + `enforceLengthCap`. Trust-boundary defense on every emitted directive body. |
| `frontmatter.ts`  | Effect Schema for SPEC.md frontmatter (private constructor); `decodeSpecFrontmatter` boundary. |
| `emit.ts`         | Canonical SPEC.md serializer; LF + lex-sort + source-order + remark-parse for body prose. |

## Why these files share a folder

JSDoc parser + spec emitter + escape helpers all share knowledge of the
SPEC.md format: the directive grammar parsed by `directives.ts` is what
`emit.ts` writes back to disk; both go through `escape.ts` for residual
bodies. They change together.

## Directive grammar

`directives.ts` carries 11 directive types across three call-site populations:

- File-level (on `index.ts` barrels): `@spec.purpose`, `@spec.ignore`.
- Per-export: `@spec.assume`, `@spec.guarantee`, `@spec.residual-contract`,
  `@spec.skip`, `@spec.ignore-export`.
- Per-test (above each `itSpec.prop`/`itSpec.todo` call): `@spec.property`,
  `@spec.kind`, `@spec.exports`, `@spec.claim`.

The codemod's `generate` mode (modes/generate.ts) walks BOTH source and
test files; the `## Properties` table in emitted SPEC.md is sourced from
the test-side directives, other sections from source-side directives.
