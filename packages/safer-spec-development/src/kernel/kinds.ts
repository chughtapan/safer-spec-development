/**
 * @spec.purpose Closed enum of OOPSLA-significant property kinds.
 *
 *   Source: Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered to the 9
 *   statistically significant ones. Dropped: Generated-Expression Bounds
 *   Checking (p=0.0627), Generated-Expression Non-Equality (p=0.3299),
 *   Constant Inclusion (p=0.8969).
 *
 *   This enum is closed-by-default. Per-repo extension via
 *   `safer-spec.config.ts` `kindsExtension: Kind[]`.
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

export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}
