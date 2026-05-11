/**
 * @specPurpose
 *   Library facade. Re-exports the test-author surface: the `itSpec` helper
 *   and the closed property-type taxonomy. The `safer-spec` binary
 *   (commands/index.ts) is the integration point for command execution
 *   (`generate`, `validate`, `init`, `doctor`, `migrate`, `explain`); those
 *   are not re-exported from this facade.
 *
 *   This barrel carries `@specPurpose` only. Per-export `@specAssume`,
 *   `@specGuarantee`, and `@specResidualContract` directives live on the
 *   declarations in their source modules.
 */

export { PROPERTY_TYPES, type PropertyType } from "./property-types/index.js";
export { itSpec, type ItSpec } from "./spec/index.js";
