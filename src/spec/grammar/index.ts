/**
 * @spec.purpose Barrel for `spec/grammar/`. Re-exports the `@spec.*`
 *   directive parsers, the closed `PropertyType` vocabulary, and the
 *   `itSpec` runtime encoding. The directive grammar has two sides —
 *   JSDoc (authored, parsed) and runtime (`itSpec.todo`/`itSpec.prop`) —
 *   both expressed here. `validate --implemented` cross-checks the two
 *   encodings.
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
  ParseError,
} from "@safer/spec/grammar/directives.js";

export { itSpec } from "@safer/spec/grammar/it-spec.js";
export type { ItSpec } from "@safer/spec/grammar/it-spec.js";

export { PROPERTY_TYPES } from "@safer/spec/grammar/property-types.js";
export type { PropertyType } from "@safer/spec/grammar/property-types.js";
