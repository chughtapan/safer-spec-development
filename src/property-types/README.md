# `property-types/` — closed taxonomy of property assertion types

Terminal domain. No upward dependencies. Holds the closed vocabulary that
every other domain reaches for to talk about property-based testing.

| Export             | Role                                                                                                                  |
|--------------------|-----------------------------------------------------------------------------------------------------------------------|
| `PropertyType`     | Type alias: one of the 9 OOPSLA-significant property assertion kinds (Roundtrip, Inclusion, Exception Raising, …).    |
| `PROPERTY_TYPES`   | `readonly tuple` of the 9 assertion-kind strings, in stable order.                                                    |

## Default-all + explicit opt-out

The codemod assumes ALL property types apply to every export by default.
Opting out is explicit via per-export `@spec.skip "<PropertyType>" reason: <why>`
directives. There is no built-in matrix mapping export shapes to required
property types — that prescription lives in the author's `@spec.skip`
reasons, not in the tool.

## Consumers

- `spec/directives.ts` embeds `PROPERTY_TYPES` into the directive grammar
  (`Schema.Literal(...PROPERTY_TYPES)`).
- `spec/sidecar.ts` embeds `PROPERTY_TYPES` into the sidecar JSON schema.

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
