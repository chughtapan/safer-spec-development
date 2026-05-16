# `spec/grammar/` — the @spec.* directive language

The 11-tag JSDoc grammar the codemod parses out of source comments, plus its runtime encoding (`itSpec`) and the closed `PropertyType` vocabulary the `@spec.type` directive validates against.

| File | Job |
|---|---|
| `directives.ts` | Public parser barrel — re-exports `parseFileDirectives`, `parsePurpose`, `parseAssume`, `parseGuarantee`, `parseResidualContract`, `parseSkip`, `parseIgnoreExport`, `parseProperty`, `parseType`, `parseExports`, `parseClaim`, `parseIgnore`, the `Directive` union, and the directive tagged errors (`JsDocDirectiveOverflowError`, `JsDocDirectiveParseError`, `JsDocUnknownDirectiveError`). |
| `shared.ts` | Per-directive body parsers + shared helpers (`splitReason`, `unquote`, `checkBodyLen`). `DIRECTIVE_BODY_MAX_CHARS = 500`. |
| `file-level.ts` | Parsers for the two file-level directives: `@spec.purpose`, `@spec.ignore`. |
| `per-export.ts` | Parsers for per-export directives: `@spec.assume`, `@spec.guarantee`, `@spec.residual-contract`, `@spec.skip`, `@spec.ignore-export`. |
| `per-test.ts` | Parsers for per-test directives: `@spec.property`, `@spec.type`, `@spec.exports`, `@spec.claim`. |
| `tsdoc-bridge.ts` | Translates `@spec.foo` dotted tags into TSDoc's flat camelCase before handing off to `@microsoft/tsdoc`. |
| `property-types.ts` | `PROPERTY_TYPES` — the closed 9-tuple OOPSLA property taxonomy. The vocabulary `@spec.type` parses against and `validate --implemented`'s `typeCoverage` gate iterates. |
| `it-spec.ts` | `itSpec.todo(id, meta)` and `itSpec.prop(id, meta, arb, body)` — the runtime form of the per-export directive metadata. Test authors call this; the codemod cross-checks the runtime opts against the JSDoc directives above each call site. |

The directive grammar is two-sided: JSDoc (authored, parsed) and runtime (`itSpec` calls). Both express the same per-export metadata. `validate --implemented`'s `MissingSpecPropertyError` fires when the two disagree.
