/**
 * @spec.purpose Closed enum of OOPSLA-significant property kinds. Terminal
 *   domain — no upward dependencies. Every other domain reaches for `Kind`
 *   and `KINDS`.
 *
 *   Source: Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered to the 9
 *   statistically significant ones. Dropped: Generated-Expression Bounds
 *   Checking (p=0.0627), Generated-Expression Non-Equality (p=0.3299),
 *   Constant Inclusion (p=0.8969).
 *
 *   Closed-by-default. Per-repo extension via `safer-spec.config.ts`
 *   `kindsExtension: Kind[]`.
 */

/**
 * @spec.guarantee "membership order is stable across versions; the index of each kind is part of the contract"
 *   reason: per-repo `kindsExtension` appends only; never reorders.
 * @spec.residual-contract none
 *   reason: shape captured by `as const` tuple.
 */
export const KINDS = [
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

export type Kind = (typeof KINDS)[number];

// Intentionally no `isKind` predicate. Validation crosses a boundary, so the
// boundary uses the Schema directly: `Schema.decodeUnknown(Schema.Literal(...KINDS))`.
// A standalone predicate is the human-era pattern (cheap to type, easy to forget
// the schema branch); the agent-era equivalent is "decode at the boundary, trust
// the type inside" (PRINCIPLES.md §2). Callers outside this domain decode via
// the consuming Schema (e.g., spec/directives.ts's KindDirectiveSchema,
// sidecar/schema.ts's SpecExportEntry.requiredKinds).
