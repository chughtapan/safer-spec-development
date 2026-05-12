/**
 * @spec.purpose Escape directive body content for safe emission into Markdown,
 *   YAML frontmatter, and JSON sidecars. Defuses prompt-injection vectors via
 *   residual-contract strings that downstream agents will read as context.
 *
 *   Co-located with the directive grammar (`directives.ts`) since
 *   `enforceLengthCap` shares the cap constant and emits the same overflow
 *   error class. The four escape functions are exported as the
 *   spec domain's emit-time sanitization boundary.
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
} from "@safer/spec/directives/index.js";

interface EscapeContext {
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}

const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

const stripControlChars = (input: string): string =>
  input.replace(CONTROL_CHARS, "");

/**
 * @spec.guarantee "output is markdown-safe; backticks, code-fences, link syntax characters, HTML angle brackets are escaped"
 *   reason: trust contract; emitted into SPEC.md prose where attacker-controlled directive bodies could otherwise inject markup.
 * @spec.residual-contract "the escaping is one-way; round-trip through `decode` does not return the original string"
 *   reason: behavioral residue; downstream readers see escaped form.
 */
export const escapeForMarkdown = (
  input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.sync(() =>
    stripControlChars(input)
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r?\n/g, " "),
  );

/**
 * @spec.guarantee "output is YAML-safe; quotes, colons, dashes at line start are escaped"
 *   reason: trust contract; emitted into SPEC.md frontmatter.
 * @spec.residual-contract "the escaping is one-way"
 *   reason: same as escapeForMarkdown.
 */
export const escapeForYaml = (
  input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> =>
  Effect.sync(() => {
    const stripped = stripControlChars(input)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, " ");
    return `"${stripped}"`;
  });

/**
 * @spec.guarantee "output is JSON-string-safe; quotes, backslashes, control characters are escaped"
 *   reason: trust contract; emitted into `.safer-spec/&lt;folder>.json`.
 * @spec.residual-contract "the escaping is one-way"
 *   reason: same as escapeForMarkdown.
 */
export const escapeForJson = (
  input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> => Effect.sync(() => JSON.stringify(input));

/**
 * @spec.guarantee "output is safe to interpolate into a single markdown-table cell; pipes are backslash-escaped and CR/LF are replaced with the HTML `<br>` token so the table grammar is preserved"
 *   reason: GFM/CommonMark tables use `|` as column delimiter and treat the
 *           first newline as row terminator; raw user-controlled directive
 *           text would otherwise break or extend rows.
 * @spec.residual-contract "intra-cell `\\` is escaped to `\\\\` before pipe-escape so the resulting backslash-pipe sequence is unambiguous; output remains markdown text (not HTML-escaped beyond the `<br>` substitution)"
 *   reason: the surrounding prose-escape (escapeForMarkdown) is the right
 *           tool for non-table contexts; this helper is the table-only
 *           additive layer.
 */
export const escapeForMarkdownTableCell = (input: string): string =>
  input
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");

/**
 * @spec.guarantee "safe inside an un-code-spanned table cell; pipes, backticks, asterisks, underscores, brackets, angle brackets are escaped; CR/LF become `<br>`; control chars stripped; single pass so backslashes are not double-escaped"
 *   reason: property-table `Claim` carries author-controlled directive prose;
 *           chaining prose + table-cell helpers would double-escape `\\`.
 * @spec.residual-contract "one-way; round-trip through a markdown decoder does not return the original string"
 *   reason: same as the other escape helpers.
 */
export const escapeForMarkdownTableCellProse = (input: string): string =>
  stripControlChars(input)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");

/**
 * @spec.guarantee "output is safe to interpolate into markdown PROSE; backticks, code-fences, link syntax characters, asterisks, underscores, and HTML angle brackets are escaped; control characters are stripped"
 *   reason: trust contract for sync emit paths (the Effect-flavored
 *           `escapeForMarkdown` is for Effect contexts; this is the
 *           same defense applied synchronously).
 * @spec.residual-contract "one-way; round-trip through a markdown decoder does not return the original string"
 *   reason: same as escapeForMarkdown.
 */
export const escapeForMarkdownProse = (input: string): string =>
  stripControlChars(input)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, " ");

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
