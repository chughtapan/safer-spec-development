/**
 * @spec.purpose Property stubs for the JSDoc directive parser and its
 *   escape-on-emit helpers. Rejects unknown directives; rejects oversize
 *   bodies; the parsed AST matches the closed grammar in `directives.ts`;
 *   escape helpers preserve safe substitution into Markdown / YAML / JSON.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import {
  enforceLengthCap,
  escapeForJson,
  escapeForMarkdown,
  escapeForYaml,
} from "@safer/spec/escape.js";
import { parseFileDirectives } from "@safer/spec/directives/index.js";

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
itSpec.todo("jsdoc-escape-markdown-safe", {
  type: "Constant Bounds Checking",
  exports: [escapeForMarkdown],
});

/**
 * @spec.property jsdoc-escape-yaml-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports escapeForYaml
 * @spec.claim escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes)
 */
itSpec.todo("jsdoc-escape-yaml-safe", {
  type: "Constant Bounds Checking",
  exports: [escapeForYaml],
});

/**
 * @spec.property jsdoc-escape-json-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports escapeForJson
 * @spec.claim escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars)
 */
itSpec.todo("jsdoc-escape-json-safe", {
  type: "Constant Bounds Checking",
  exports: [escapeForJson],
});

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
