/**
 * @spec.purpose Format version constant for SPEC.md frontmatter and the
 *   `.safer-spec/&lt;folder>.json` sidecar JSON. Co-located with the
 *   commands because `generate.ts` stamps it onto every emitted
 *   SPEC.md. CHANGELOG signposts bumps before they ship; the
 *   `safer-spec-migrate` skill walks committed artifacts across the
 *   bump.
 */

/**
 * @spec.guarantee "value is a stable string literal across all calls within one process"
 *   reason: declared `as const` in source; re-evaluation cannot drift.
 * @spec.residual-contract "callers must treat as opaque; cross-version comparisons go through the safer-spec-migrate skill"
 *   reason: comparison logic is migrate's responsibility; the skill walks SPEC.md + sidecar artifacts during format-version transitions.
 */
export const SPEC_FORMAT_VERSION = "0.1.0" as const;
