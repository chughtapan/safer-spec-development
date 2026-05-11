/**
 * @spec.purpose Format version constant for SPEC.md frontmatter and the
 *   `.safer-spec/<folder>.json` sidecar JSON. Bumped on breaking format
 *   changes; `safer-spec migrate` reads this to apply format-version
 *   transitions.
 */

/**
 * @spec.guarantee "value is a stable string literal across all calls within one process"
 *   reason: declared `as const` in source; re-evaluation cannot drift.
 * @spec.residual-contract "callers must treat as opaque; format-version comparisons go through `safer-spec migrate`"
 *   reason: comparison logic is the migrate codemod's responsibility,
 *           not consumer code's.
 */
export const SPEC_FORMAT_VERSION = "0.1.0" as const;
