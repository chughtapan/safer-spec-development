/**
 * @spec.purpose Property stubs for the escape-on-emit helpers. Each helper
 *   defuses a different injection vector: markdown, YAML, JSON. The
 *   directive-grammar parser shares this domain because the body-length cap
 *   on directives and the escape helpers both live in `spec/escape.ts`.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/it-spec.js";
import {
  escapeForJson,
  escapeForMarkdown,
  escapeForYaml,
} from "@safer/spec/escape.js";

const ESCAPE_CTX = { path: "test.ts", line: 1, directive: "test" };

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
 * @spec.property jsdoc-escape-markdown-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports escapeForMarkdown
 * @spec.claim escaped output never introduces new markdown syntactic structure (backticks, code-fences, link syntax)
 */
itSpec.prop(
  "jsdoc-escape-markdown-safe",
  { type: "Constant Bounds Checking", exports: [escapeForMarkdown] },
  fc.string(),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = yield* escapeForMarkdown(input, ESCAPE_CTX);
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
 * @spec.property jsdoc-escape-yaml-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports escapeForYaml
 * @spec.claim escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes)
 */
itSpec.prop(
  "jsdoc-escape-yaml-safe",
  { type: "Constant Bounds Checking", exports: [escapeForYaml] },
  fc.string(),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = yield* escapeForYaml(input, ESCAPE_CTX);
        yield* failIf(
          !out.startsWith('"') || !out.endsWith('"'),
          `yaml escape must wrap in double quotes: ${JSON.stringify(out)}`,
        );
        const inner = out.slice(1, -1);
        yield* failIf(
          hasUnescapedChar(inner, '"'),
          `unescaped quote in yaml: ${JSON.stringify(out)}`,
        );
        yield* failIf(/[\n\r]/.test(inner), `raw newline leaked: ${JSON.stringify(out)}`);
      }),
    ),
);

/**
 * @spec.property jsdoc-escape-json-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports escapeForJson
 * @spec.claim escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars)
 */
itSpec.prop(
  "jsdoc-escape-json-safe",
  { type: "Constant Bounds Checking", exports: [escapeForJson] },
  fc.string(),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = yield* escapeForJson(input, ESCAPE_CTX);
        const decoded = JSON.parse(out) as unknown;
        yield* failIf(
          decoded !== input,
          `json escape did not roundtrip: ${JSON.stringify({ input, out, decoded })}`,
        );
      }),
    ),
);
