/**
 * @spec.purpose
 *   `@chughtapan/safer-spec-development` library facade. The library has
 *   one consumer population: test authors who write `*.spec.test.ts` files
 *   declaring property stubs. They need the `itSpec` helper and the closed
 *   kinds taxonomy. That is the entire library surface.
 *
 *   CI integrators run the `safer-spec` binary (cli/index.ts); they do NOT
 *   reach for the library's mode entries programmatically. That is the
 *   binary's job. Hiding `generate` / `validate` / `init` / `doctor` /
 *   `migrate` / `explain` from the library facade makes the deal explicit:
 *   one binary, one library helper API. Consumers who actually need
 *   programmatic mode access can land that subpath export when there's a
 *   second consumer.
 *
 *   This barrel carries `@spec.purpose` only. Per-export `@spec.assume`,
 *   `@spec.guarantee`, and `@spec.residual-contract` directives live on the
 *   declarations in their source modules.
 */

export { KINDS, type Kind } from "./kinds/index.js";
export { itSpec, type ItSpec } from "./authoring/index.js";
