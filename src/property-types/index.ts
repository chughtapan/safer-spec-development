/**
 * @spec.purpose Closed taxonomy of property assertion types. Terminal
 *   domain — no upward dependencies.
 *
 *   The 9 OOPSLA-significant property types (Roundtrip, Inclusion, Exception
 *   Raising, …). Source: Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered
 *   to the 9 statistically significant ones. Dropped: Generated-Expression
 *   Bounds Checking (p=0.0627), Generated-Expression Non-Equality
 *   (p=0.3299), Constant Inclusion (p=0.8969).
 *
 *   The codemod assumes ALL property types apply to every export by default.
 *   Opting out is explicit via per-export `@spec.skip "<PropertyType>"
 *   reason: <why>` directives. There is no built-in matrix mapping export
 *   shapes to required property types — that prescription belongs in the
 *   author's `@spec.skip` reasons, not in the tool.
 *
 *   Per-repo extension via `safer-spec.config.ts`
 *   `propertyTypesExtension: PropertyType[]`.
 */

/**
 * @spec.guarantee "membership order is stable across versions; the index of each property type is part of the contract"
 *   reason: per-repo `propertyTypesExtension` appends only; never reorders.
 * @spec.residual-contract none
 *   reason: shape captured by `as const` tuple.
 */
export const PROPERTY_TYPES = [
  "Roundtrip",
  "Partial Roundtrip",
  "Commutative Paths",
  "Constant Equality",
  "Constant Bounds Checking",
  "Constant Non-Equality",
  "Typechecking",
  "Inclusion",
  "Exception Raising",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

// Callers validate via `Schema.decodeUnknown(Schema.Literal(...PROPERTY_TYPES))`
// at the boundary; no standalone predicate.
