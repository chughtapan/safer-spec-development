/**
 * @spec.purpose Format version constant for MODULE.md frontmatter and the
 *   `.safer-spec/&lt;folder>.json` sidecar JSON. Co-located with the
 *   commands because `generate.ts` stamps it onto every emitted
 *   MODULE.md. CHANGELOG signposts bumps before they ship; the
 *   `safer-spec-migrate` skill walks committed artifacts across the
 *   bump.
 */

/**
 * @spec.guarantee "value is a stable string literal across all calls within one process"
 *   reason: declared `as const` in source; re-evaluation cannot drift.
 * @spec.residual-contract "callers must treat as opaque; cross-version comparisons go through the safer-spec-migrate skill"
 *   reason: comparison logic is migrate's responsibility; the skill walks MODULE.md + sidecar artifacts during format-version transitions.
 * @spec.skip "Roundtrip"
 *   reason: a string constant; no encode/decode pair.
 * @spec.skip "Partial Roundtrip"
 *   reason: a string constant; no normalize-then-recover relation.
 * @spec.skip "Commutative Paths"
 *   reason: a constant; no alternative path to derive it.
 * @spec.skip "Constant Non-Equality"
 *   reason: a single string value; no distinct-output invariant applies.
 * @spec.skip "Exception Raising"
 *   reason: a constant; cannot fail.
 */
export const SPEC_FORMAT_VERSION = "0.1.0" as const;
