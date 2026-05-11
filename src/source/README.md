# `source/` — TypeScript source analysis domain

Everything about analyzing TypeScript source via ts-morph lives here.
Classifies each export by structural shape, fail-closes on ambiguity,
resolves required-property-type sets via the applicability matrix, and
resolves backticked symbol references in SPEC.md body prose.

| File              | Role                                                                                                                  |
|-------------------|-----------------------------------------------------------------------------------------------------------------------|
| `shape-detector.ts` | `detectExports`. Tagged errors `UnknownExportShapeError`, `AmbiguousPropertyTypeError` co-located.                  |
| `failclosed.ts`   | Helpers that raise the two shape-detector errors; never silently misclassifies.                                       |
| `applicability.ts`| `resolveExport` — applies `APPLICABILITY_MATRIX` (from `property-types/`) + escape hatches. Tagged error `ApplicabilityResolutionError` co-located. |
| `link-resolver.ts`| `resolveSymbol` — intra-file + cross-spec backticked references. Tagged error `LinkResolutionError` co-located.       |

## Why these files share a folder

Shape detection, applicability resolution, and link resolution all consume
ts-morph's typed AST and emit primitive vocabulary that `commands/`
consumes. They share the analyzer's lifecycle (project + program + type
checker setup) and the fail-closed discipline.

## Failclose discipline

Every type-resolution path that could be ambiguous emits
`UnknownExportShapeError` or `AmbiguousPropertyTypeError` rather than
guessing. Silent misclassification is the bug class this domain prevents.
