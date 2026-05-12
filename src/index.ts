/**
 * @spec.purpose
 *   Library facade. Re-exports the test-author surface: the `itSpec`
 *   helper, the closed property-type taxonomy, and the Vitest reporter
 *   class downstream consumers register in their own `vitest.config.ts`
 *   so `validate --implemented` can find the per-folder execution
 *   sidecar. The `safer-spec` binary (commands/index.ts) is the
 *   integration point for command execution (`generate`, `validate`,
 *   `doctor`, `explain`); those are not re-exported. Folder onboarding
 *   and format-version migration ship as coding-agent skills under
 *   `skills/`, not as CLI commands.
 *
 *   This barrel carries `@spec.purpose` only. Per-export `@spec.assume`,
 *   `@spec.guarantee`, and `@spec.residual-contract` directives live on
 *   the declarations in their source modules.
 */

export { PROPERTY_TYPES, type PropertyType } from "./property-types/index.js";
export {
  itSpec,
  type ItSpec,
  SaferSpecExecutionReporter,
} from "./spec/index.js";
