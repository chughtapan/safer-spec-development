/**
 * @spec.purpose Property stubs for the JSDoc directive parser and its
 *   escape-on-emit helpers. Rejects unknown directives; rejects oversize
 *   bodies; the parsed AST matches the closed grammar in `directives.ts`;
 *   escape helpers preserve safe substitution into Markdown / YAML / JSON.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/it-spec.js";
import {
  enforceLengthCap,
  escapeForJson,
  escapeForMarkdown,
  escapeForYaml,
} from "@safer/spec/escape.js";
import { parseFileDirectives } from "@safer/spec/directives/index.js";

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
 * @spec.property jsdoc-parser-rejects-unknown-directive
 * @spec.type Exception Raising
 * @spec.exports parseFileDirectives
 * @spec.claim unknown `@spec.*` directive names fail with JsDocUnknownDirectiveError on the Effect error channel
 */
itSpec.todo("jsdoc-parser-rejects-unknown-directive", {
  type: "Exception Raising",
  exports: [parseFileDirectives],
});

/**
 * @spec.property jsdoc-parser-ast-typechecks
 * @spec.type Typechecking
 * @spec.exports parseFileDirectives
 * @spec.claim every parsed directive matches the closed Directive union shape
 */
itSpec.todo("jsdoc-parser-ast-typechecks", {
  type: "Typechecking",
  exports: [parseFileDirectives],
});

/**
 * @spec.property jsdoc-parser-enforces-body-cap
 * @spec.type Constant Bounds Checking
 * @spec.exports parseFileDirectives, enforceLengthCap
 * @spec.claim directive bodies longer than DIRECTIVE_BODY_MAX_CHARS fail with JsDocDirectiveOverflowError
 */
itSpec.todo("jsdoc-parser-enforces-body-cap", {
  type: "Constant Bounds Checking",
  exports: [parseFileDirectives, enforceLengthCap],
});

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

/**
 * @spec.property parser-rejects-malformed-dotted-spec-tags
 * @spec.type Exception Raising
 * @spec.exports parseFileDirectives
 * @spec.claim `@spec.foo_bar`, `@spec.foo.bar`, `@spec.Type` (any dotted form the `[a-z][a-z-]*` rewriter doesn't normalize) fail with JsDocUnknownDirectiveError; the closed grammar never silently drops a misspelled directive
 */
itSpec.todo("parser-rejects-malformed-dotted-spec-tags", {
  type: "Exception Raising",
  exports: [parseFileDirectives],
});

/**
 * @spec.property parser-bounds-directive-body-at-any-block-tag
 * @spec.type Constant Equality
 * @spec.exports parseFileDirectives
 * @spec.claim a `@spec.*` directive followed by a standard JSDoc block (`@param`, `@returns`, `@throws`, ...) extracts its body only up to that next block tag — no absorption of unrelated comment content into the directive
 */
itSpec.todo("parser-bounds-directive-body-at-any-block-tag", {
  type: "Constant Equality",
  exports: [parseFileDirectives],
});

/**
 * @spec.property parser-accepts-bare-newline-reason-form
 * @spec.type Inclusion
 * @spec.exports parseFileDirectives
 * @spec.claim the multi-line form `* \@spec.guarantee "x"\n* reason: y` (no horizontal whitespace before `reason:`) parses successfully — head and reason split exactly as in the inline / indented forms
 */
itSpec.todo("parser-accepts-bare-newline-reason-form", {
  type: "Inclusion",
  exports: [parseFileDirectives],
});

/**
 * @spec.property parser-binds-member-directives-to-containing-export
 * @spec.type Constant Equality
 * @spec.exports parseFileDirectives
 * @spec.claim a `@spec.assume`/`@spec.guarantee` JSDoc on an interface method / property signature / class member binds to the enclosing exportable declaration, not the member itself
 */
itSpec.todo("parser-binds-member-directives-to-containing-export", {
  type: "Constant Equality",
  exports: [parseFileDirectives],
});

/**
 * @spec.property parser-routes-aliased-reexport-directives-to-public-name
 * @spec.type Constant Equality
 * @spec.exports parseFileDirectives
 * @spec.claim JSDoc directives on `foo` reach the export entry keyed by the public alias `bar` when the barrel re-exports as `export { foo as bar }`; `@spec.ignore-export foo` also drops the aliased export
 */
itSpec.todo("parser-routes-aliased-reexport-directives-to-public-name", {
  type: "Constant Equality",
  exports: [parseFileDirectives],
});
