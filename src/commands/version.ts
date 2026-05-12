/**
 * @spec.purpose Format version constant for SPEC.md frontmatter and the
 *   `.safer-spec/<folder>.json` sidecar JSON. Co-located with the
 *   commands because `migrate.ts` bumps it during format-version
 *   transitions and `generate.ts` stamps it onto every emitted SPEC.md.
 */

/**
 * @spec.guarantee "value is a stable string literal across all calls within one process"
 *   reason: declared `as const` in source; re-evaluation cannot drift.
 * @spec.residual-contract "callers must treat as opaque; format-version comparisons go through `migrate`"
 *   reason: comparison logic is migrate's responsibility.
 */
export const SPEC_FORMAT_VERSION = "0.1.0" as const;
