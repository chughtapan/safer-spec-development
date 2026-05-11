/**
 * @specPurpose Property stubs for the JSDoc directive parser and its
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
 * @specProperty jsdoc-parser-rejects-unknown-directive
 * @specType Exception Raising
 * @specExports parseFileDirectives
 * @specClaim unknown @spec.* directive names fail with JsDocUnknownDirectiveError on the Effect error channel
 */
itSpec.todo("jsdoc-parser-rejects-unknown-directive", {
  type: "Exception Raising",
  exports: [parseFileDirectives],
});

/**
 * @specProperty jsdoc-parser-ast-typechecks
 * @specType Typechecking
 * @specExports parseFileDirectives
 * @specClaim every parsed directive matches the closed Directive union shape
 */
itSpec.todo("jsdoc-parser-ast-typechecks", {
  type: "Typechecking",
  exports: [parseFileDirectives],
});

/**
 * @specProperty jsdoc-parser-enforces-body-cap
 * @specType Constant Bounds Checking
 * @specExports parseFileDirectives, enforceLengthCap
 * @specClaim directive bodies longer than DIRECTIVE_BODY_MAX_CHARS fail with JsDocDirectiveOverflowError
 */
itSpec.todo("jsdoc-parser-enforces-body-cap", {
  type: "Constant Bounds Checking",
  exports: [parseFileDirectives, enforceLengthCap],
});

/**
 * @specProperty jsdoc-escape-markdown-safe
 * @specType Constant Bounds Checking
 * @specExports escapeForMarkdown
 * @specClaim escaped output never introduces new markdown syntactic structure (backticks, code-fences, link syntax)
 */
itSpec.todo("jsdoc-escape-markdown-safe", {
  type: "Constant Bounds Checking",
  exports: [escapeForMarkdown],
});

/**
 * @specProperty jsdoc-escape-yaml-safe
 * @specType Constant Bounds Checking
 * @specExports escapeForYaml
 * @specClaim escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes)
 */
itSpec.todo("jsdoc-escape-yaml-safe", {
  type: "Constant Bounds Checking",
  exports: [escapeForYaml],
});

/**
 * @specProperty jsdoc-escape-json-safe
 * @specType Constant Bounds Checking
 * @specExports escapeForJson
 * @specClaim escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars)
 */
itSpec.todo("jsdoc-escape-json-safe", {
  type: "Constant Bounds Checking",
  exports: [escapeForJson],
});
