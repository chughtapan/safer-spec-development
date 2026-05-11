# `property-types/` — closed taxonomy + applicability matrix

Terminal domain. No upward dependencies. Holds the closed vocabulary
every other domain reaches for to talk about property-based testing
of TypeScript source.

| Export                  | Role                                                                                                                  |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `PropertyType`          | Type alias: one of the 9 OOPSLA-significant property assertion kinds (Roundtrip, Inclusion, Exception Raising, …).    |
| `PROPERTY_TYPES`        | `readonly tuple` of the 9 assertion-kind strings, in stable order.                                                    |
| `ExportShape`           | Type alias: one of the 6 structural shapes a TypeScript export can take (Schema, RpcDefinition, function, type, Branded, unknown). |
| `APPLICABILITY_MATRIX`  | Static `ReadonlyArray<ApplicabilityRow>` mapping each `ExportShape` to its required + conditional property types.     |

## Consumers

- `spec/` embeds `PROPERTY_TYPES` into directive + sidecar schemas
  (`Schema.Literal(...PROPERTY_TYPES)`).
- `source/shape-detector.ts` outputs `ExportShape` from ts-morph analysis.
- `source/applicability.ts` reads `APPLICABILITY_MATRIX` to compute the
  required-kind set for each detected export.
- `commands/validate.ts` raises `AmbiguousPropertyTypeError` when source
  resolution is ambiguous.

## Source: OOPSLA 2025

`PROPERTY_TYPES` is Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered
to the 9 statistically significant ones. Dropped: Generated-Expression
Bounds Checking (p=0.0627), Generated-Expression Non-Equality (p=0.3299),
Constant Inclusion (p=0.8969).

Per-repo additions go through explicit `propertyTypesExtension` config,
not ad hoc strings in comments.

## Validation

Callers decode unknown input through `Schema.decodeUnknown(Schema.Literal(...PROPERTY_TYPES))`
at trust boundaries. No standalone predicate.
