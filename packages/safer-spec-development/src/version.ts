/**
 * @spec.purpose Format version for SPEC.md frontmatter and .safer-spec sidecar JSON.
 *   Bumped on breaking format changes; `safer-spec migrate` reads this to apply
 *   format-version transitions.
 */
export const SPEC_FORMAT_VERSION = "0.1.0" as const;
