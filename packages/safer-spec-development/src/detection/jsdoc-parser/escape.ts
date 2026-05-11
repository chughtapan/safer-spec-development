/**
 * @spec.purpose Escape directive body content for safe emission into Markdown,
 *   YAML frontmatter, and JSON sidecars. Defuses prompt-injection vectors via
 *   residual-contract strings that downstream agents will read as context.
 *
 * @spec.guarantee Every output of these functions is safe to interpolate into
 *   its target surface (Markdown / YAML / JSON) without producing an extra
 *   syntactic structure.
 *   reason: directives are user-controlled JSDoc; agents read this content as
 *           part of downstream dispatch context.
 */

import { Effect } from "effect";
import { JsDocDirectiveOverflowError } from "../../errors/index.js";
import { DIRECTIVE_BODY_MAX_CHARS } from "./directives.js";

export interface EscapeContext {
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}

export const escapeForMarkdown = (
  _input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Stage 1 stub: escapeForMarkdown not implemented"));

export const escapeForYaml = (
  _input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Stage 1 stub: escapeForYaml not implemented"));

export const escapeForJson = (
  _input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Stage 1 stub: escapeForJson not implemented"));

export const enforceLengthCap = (
  input: string,
  context: EscapeContext,
): Effect.Effect<string, JsDocDirectiveOverflowError> =>
  input.length > DIRECTIVE_BODY_MAX_CHARS
    ? Effect.fail(
        new JsDocDirectiveOverflowError({
          path: context.path,
          line: context.line,
          directive: context.directive,
          length: input.length,
          limit: DIRECTIVE_BODY_MAX_CHARS,
        }),
      )
    : Effect.succeed(input);
