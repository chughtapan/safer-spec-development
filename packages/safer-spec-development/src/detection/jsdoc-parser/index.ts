/**
 * @spec.purpose
 *   Parses JSDoc `@spec.*` directives from TypeScript source into a structured
 *   AST. Validates directive grammar (5 directives: purpose, skip,
 *   residual-contract, assume, guarantee — plus 2 escape hatches: ignore,
 *   ignore-export). Caps body length at 500 chars and escapes on emit to defuse
 *   prompt-injection via residual-contract directives.
 *
 * @spec.guarantee All parsed directives validate against the closed grammar
 *   before downstream consumption; unknown directive names exit with
 *   `JsDocUnknownDirectiveError`, malformed bodies exit with
 *   `JsDocDirectiveParseError`.
 *   reason: trust-boundary; agents consume parsed directive bodies as context.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type {
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
  JsDocUnknownDirectiveError,
} from "../../errors/index.js";
import type { LocatedDirective } from "./directives.js";

type ParseError =
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError
  | JsDocDirectiveOverflowError;

export const parseFileDirectives = (
  _path: string,
  _source: string,
): Effect.Effect<ReadonlyArray<LocatedDirective>, ParseError> =>
  Eff.die(new Error("Stage 1 stub: parseFileDirectives not implemented"));

export {
  enforceLengthCap,
  escapeForJson,
  escapeForMarkdown,
  escapeForYaml,
} from "./escape.js";
