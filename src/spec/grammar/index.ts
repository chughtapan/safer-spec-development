/**
 * @spec.purpose Barrel for `spec/grammar/`. Re-exports the `@spec.*`
 *   directive parsers and the closed `PropertyType` vocabulary.
 *
 *   `it-spec.ts` is INTENTIONALLY NOT re-exported here. The runtime
 *   encoding of per-export directive metadata (`itSpec.todo` /
 *   `itSpec.prop`) imports Vitest's `it`; Vitest's module throws when
 *   loaded outside a test runner (e.g. when the `safer-spec` CLI binary
 *   is invoked). Re-exporting `itSpec` through this barrel would
 *   transitively pull Vitest into every cross-folder consumer of any
 *   grammar export (directive parsers, types, PROPERTY_TYPES), crashing
 *   the CLI. Tests reach `itSpec` directly via
 *   `@safer/spec/grammar/it-spec.js`; the package's main facade
 *   (`src/index.ts`) re-exports it for downstream authors.
 *
 *   `SaferSpecExecutionReporter` in `spec/artifact/index.ts` has the
 *   same exclusion for the same reason.
 */

export {
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
  JsDocUnknownDirectiveError,
  parseFileDirectives,
} from "@safer/spec/grammar/directives.js";
export type {
  Directive,
  LocatedDirective,
} from "@safer/spec/grammar/directives.js";

export { PROPERTY_TYPES } from "@safer/spec/grammar/property-types.js";
export type { PropertyType } from "@safer/spec/grammar/property-types.js";
