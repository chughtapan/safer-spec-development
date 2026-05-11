# `source/` — TypeScript source analysis domain

Everything about analyzing TypeScript source via ts-morph lives here.
Classifies each export by structural shape, fail-closes on ambiguity,
resolves required-kind sets via the applicability matrix, and resolves
backticked symbol references in SPEC.md body prose.

| File                          | Role                                                                                       |
|-------------------------------|--------------------------------------------------------------------------------------------|
| `kind-detector.ts`            | `detectExports`. Tagged errors `UnknownExportShapeError`, `AmbiguousKindError` co-located. |
| `failclosed.ts`               | Helpers that raise the two kind-detector errors; never silently misclassifies.             |
| `applicability.ts`            | `resolveExport` — applies the matrix + escape hatches. Tagged error `ApplicabilityResolutionError` co-located. |
| `applicability-matrix.ts`     | Static `APPLICABILITY_MATRIX` (per ExportShape required-kind set).                         |
| `link-resolver.ts`            | `resolveSymbol` — intra-file + cross-spec backticked references. Tagged error `LinkResolutionError` co-located. |

## Why these files share a folder

Kind detection, applicability resolution, and link resolution all consume
ts-morph's typed AST and emit primitive vocabulary the codemod modes
consume. They share the analyzer's lifecycle (project + program + type
checker setup) and the fail-closed discipline.

## Failclose discipline

Every type-resolution path that could be ambiguous emits
`UnknownExportShapeError` or `AmbiguousKindError` rather than guessing.
Silent misclassification is the bug class this domain is built to prevent.
