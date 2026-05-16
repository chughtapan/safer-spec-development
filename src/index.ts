/**
 * @spec.purpose
 *   Library facade. Re-exports the test-author surface: the `itSpec`
 *   helper and the closed property-type taxonomy. The
 *   `SaferSpecExecutionReporter` class lives at a dedicated subpath
 *   (`@chughtapan/safer-spec-development/reporter`) so consumers can
 *   import it from `vitest.config.ts` without transitively loading
 *   `vitest`'s test API (which throws when imported from a config
 *   file). The `safer-spec` binary (commands/index.ts) is the
 *   integration point for command execution (`generate`, `validate`,
 *   `doctor`, `explain`); those are not re-exported. Folder onboarding
 *   and format-version migration ship as coding-agent skills under
 *   `skills/`, not as CLI commands.
 *
 *   This barrel carries `@spec.purpose` only. Per-export `@spec.assume`,
 *   `@spec.guarantee`, and `@spec.residual-contract` directives live on
 *   the declarations in their source modules.
 */

export { PROPERTY_TYPES, type PropertyType } from "./spec/grammar/property-types.js";
export { itSpec, type ItSpec } from "./spec/index.js";
