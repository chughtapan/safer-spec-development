/**
 * @spec.purpose Property stubs for the emit-time markdown escape helpers.
 *   `escapeForMarkdownProse` guards running prose; the table-cell variant
 *   additionally escapes pipes and maps newlines to `&lt;br>`. Both defuse the
 *   markdown/HTML injection vector in author-controlled directive bodies.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  escapeForMarkdownProse,
  escapeForMarkdownTableCellProse,
} from "@safer/spec/artifact/escape.js";

class EscapeAssertionError extends Data.TaggedError("EscapeAssertionError")<{
  readonly detail: string;
}> {}

// Returns true if any literal `ch` in `s` is preceded by an even (or zero)
// count of consecutive backslashes — i.e., the character is NOT escaped.
const hasUnescapedChar = (s: string, ch: string): boolean => {
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] !== ch) continue;
    let bs = 0;
    let j = i - 1;
    while (j >= 0 && s[j] === "\\") {
      bs += 1;
      j -= 1;
    }
    if (bs % 2 === 0) return true;
  }
  return false;
};

const failIf = (cond: boolean, detail: string): Effect.Effect<void, EscapeAssertionError> =>
  cond ? Effect.fail(new EscapeAssertionError({ detail })) : Effect.void;

/**
 * @spec.property jsdoc-escape-markdown-prose-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports escapeForMarkdownProse
 * @spec.claim escaped output never introduces new markdown syntactic structure (backticks, link syntax), leaks raw angle brackets, or carries a raw newline
 */
itSpec.prop(
  "jsdoc-escape-markdown-prose-safe",
  { type: "Constant Bounds Checking", exports: [escapeForMarkdownProse] },
  fc.string(),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = escapeForMarkdownProse(input);
        for (const ch of ["`", "*", "_", "[", "]"]) {
          yield* failIf(
            hasUnescapedChar(out, ch),
            `unescaped ${ch} in output: ${JSON.stringify(out)}`,
          );
        }
        yield* failIf(
          out.includes("<") || out.includes(">"),
          `raw angle bracket leaked: ${JSON.stringify(out)}`,
        );
        yield* failIf(/[\n\r]/.test(out), `raw newline leaked: ${JSON.stringify(out)}`);
      }),
    ),
);

/**
 * @spec.property jsdoc-escape-table-cell-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports escapeForMarkdownTableCellProse
 * @spec.claim escaped output escapes pipes (so it stays a single table cell), escapes markdown structure, leaks no raw angle bracket, and maps newlines to `&lt;br>`
 */
itSpec.prop(
  "jsdoc-escape-table-cell-safe",
  { type: "Constant Bounds Checking", exports: [escapeForMarkdownTableCellProse] },
  fc.string(),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = escapeForMarkdownTableCellProse(input);
        for (const ch of ["`", "*", "_", "[", "]", "|"]) {
          yield* failIf(
            hasUnescapedChar(out, ch),
            `unescaped ${ch} in output: ${JSON.stringify(out)}`,
          );
        }
        // Newlines become `<br>`; the only angle brackets allowed are those markers.
        const withoutBr = out.replace(/<br>/g, "");
        yield* failIf(
          withoutBr.includes("<") || withoutBr.includes(">"),
          `raw angle bracket leaked: ${JSON.stringify(out)}`,
        );
        yield* failIf(/[\n\r]/.test(out), `raw newline leaked: ${JSON.stringify(out)}`);
      }),
    ),
);
