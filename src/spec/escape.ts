/**
 * @spec.purpose Escape directive body content for safe emission into Markdown,
 *   YAML frontmatter, and JSON sidecars. Defuses prompt-injection vectors via
 *   residual-contract strings that downstream agents will read as context.
 *
 *   Co-located with the directive grammar (`directives.ts`) since
 *   `enforceLengthCap` shares the cap constant and emits the same overflow
 *   error class. The four escape functions are exported as the
 *   spec domain's emit-time sanitization boundary.
 *
 * @spec.guarantee Every output of these functions is safe to interpolate into
 *   its target surface (Markdown / YAML / JSON) without producing an extra
 *   syntactic structure.
 *   reason: directives are user-controlled JSDoc; agents read this content as
 *           part of downstream dispatch context.
 */

import { Effect } from "effect";
import {
  DIRECTIVE_BODY_MAX_CHARS,
  JsDocDirectiveOverflowError,
} from "@safer/spec/directives.js";

interface EscapeContext {
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}

/**
 * @spec.guarantee "output is markdown-safe; backticks, code-fences, link syntax characters, HTML angle brackets are escaped"
 *   reason: trust contract; emitted into SPEC.md prose where attacker-controlled directive bodies could otherwise inject markup.
 * @spec.residual-contract "the escaping is one-way; round-trip through `decode` does not return the original string"
 *   reason: behavioral residue; downstream readers see escaped form.
 */
export const escapeForMarkdown = (
  _input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Not implemented: escapeForMarkdown"));

/**
 * @spec.guarantee "output is YAML-safe; quotes, colons, dashes at line start are escaped"
 *   reason: trust contract; emitted into SPEC.md frontmatter.
 * @spec.residual-contract "the escaping is one-way"
 *   reason: same as escapeForMarkdown.
 */
export const escapeForYaml = (
  _input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Not implemented: escapeForYaml"));

/**
 * @spec.guarantee "output is JSON-string-safe; quotes, backslashes, control characters are escaped"
 *   reason: trust contract; emitted into `.safer-spec/<folder>.json`.
 * @spec.residual-contract "the escaping is one-way"
 *   reason: same as escapeForMarkdown.
 */
export const escapeForJson = (
  _input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Not implemented: escapeForJson"));

/**
 * @spec.guarantee "rejects input longer than DIRECTIVE_BODY_MAX_CHARS with a typed `JsDocDirectiveOverflowError`"
 *   reason: trust-boundary; over-long bodies are a prompt-injection
 *           attack surface.
 * @spec.residual-contract none
 *   reason: pure length check; behavior fully captured by signature.
 */
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
