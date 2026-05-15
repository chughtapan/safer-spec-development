/**
 * @spec.purpose
 *   Library facade. Re-exports the test-author surface: the `itSpec` helper
 *   and the closed property-type taxonomy. The `safer-spec` binary
 *   (commands/index.ts) is the integration point for command execution
 *   (`generate`, `validate`, `doctor`, `explain`); those are not
 *   re-exported from this facade. Folder onboarding and format-version
 *   migration ship as coding-agent skills under `skills/`, not as CLI
 *   commands.
 *
 *   This barrel carries `@spec.purpose` only. Per-export `@spec.assume`,
 *   `@spec.guarantee`, and `@spec.residual-contract` directives live on the
 *   declarations in their source modules.
 */

export { PROPERTY_TYPES, type PropertyType } from "./property-types/index.js";
export { itSpec, type ItSpec } from "./spec/index.js";
