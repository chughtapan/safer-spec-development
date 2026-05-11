# `spec/directives/` — `@spec.*` JSDoc grammar

Closed grammar for the `@spec.*` JSDoc directives the codemod consumes,
broken by directive population per DESIGN.md's "Section Population Rules":

| File             | Population   | Directives                                                                                   |
|------------------|--------------|----------------------------------------------------------------------------------------------|
| `file-level.ts`  | File-level   | `@spec.purpose`, `@spec.ignore` (on `index.ts` barrels)                                      |
| `per-export.ts`  | Per-export   | `@spec.assume`, `@spec.guarantee`, `@spec.residual-contract`, `@spec.skip`, `@spec.ignore-export` |
| `per-test.ts`    | Per-test     | `@spec.property`, `@spec.type`, `@spec.exports`, `@spec.claim` (above each `itSpec` call)    |
| `shared.ts`      | Infrastructure | Body caps, the three `ParseError` tagged-error classes, `unquote`, `splitReason`, `failParse`, `checkBodyLen` |
| `index.ts`       | Entry        | `Directive` union, `LocatedDirective`, `parseFileDirectives` orchestrator                    |

Each per-population file co-locates the directive Schema with the parse
function for that directive. The orchestrator (`index.ts`) holds a
`name → parser` map and dispatches each tag it finds in the source.

## Trust-boundary caps

| Directive               | Cap                            |
|-------------------------|--------------------------------|
| `@spec.purpose`         | `PURPOSE_BODY_MAX_CHARS` (5000) |
| All others              | `DIRECTIVE_BODY_MAX_CHARS` (500) |

The smaller cap defends against prompt-injection in directive bodies
that get routed as agent context. Purpose is paragraph-scale
documentation, not a trust-boundary residue, so its cap is larger.

## Parser

`index.ts` uses `@microsoft/tsdoc` for block-tag extraction. The 11
`@specXxx` tag names are registered as `BlockTag` definitions in a
single `TSDocConfiguration`, and each parsed `DocBlock`'s content tree
is rendered to plain text (DocPlainText + DocSoftBreak) before being
handed to its per-population parser as `rawBody`.

ts-morph still does the AST navigation (finding each JSDoc node and its
enclosing export). TSDoc owns the directive grammar.

Unknown `@spec*` tag names are detected via a bounded pre-scan
(`/@(spec[A-Za-z]{0,32})\b/g`) and rejected with
`JsDocUnknownDirectiveError` so misspellings fail closed.
