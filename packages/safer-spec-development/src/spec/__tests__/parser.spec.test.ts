/**
 * @spec.purpose Property stubs for the JSDoc directive parser and its
 *   escape-on-emit helpers. Rejects unknown directives; rejects oversize
 *   bodies; the parsed AST matches the closed grammar in `directives.ts`;
 *   escape helpers preserve safe substitution into Markdown / YAML / JSON.
 */

import { itSpec } from "@safer/authoring/index.js";
import {
  enforceLengthCap,
  escapeForJson,
  escapeForMarkdown,
  escapeForYaml,
} from "@safer/spec/escape.js";
import { parseFileDirectives } from "@safer/spec/directives.js";

/**
 * @spec.property jsdoc-parser-rejects-unknown-directive
 * @spec.kind Exception Raising
 * @spec.exports parseFileDirectives
 * @spec.claim unknown @spec.* directive names fail with JsDocUnknownDirectiveError on the Effect error channel
 */
itSpec.todo("jsdoc-parser-rejects-unknown-directive", {
  kind: "Exception Raising",
  exports: [parseFileDirectives],
});

/**
 * @spec.property jsdoc-parser-ast-typechecks
 * @spec.kind Typechecking
 * @spec.exports parseFileDirectives
 * @spec.claim every parsed directive matches the closed Directive union shape
 */
itSpec.todo("jsdoc-parser-ast-typechecks", {
  kind: "Typechecking",
  exports: [parseFileDirectives],
});

/**
 * @spec.property jsdoc-parser-enforces-body-cap
 * @spec.kind Constant Bounds Checking
 * @spec.exports parseFileDirectives, enforceLengthCap
 * @spec.claim directive bodies longer than DIRECTIVE_BODY_MAX_CHARS fail with JsDocDirectiveOverflowError
 */
itSpec.todo("jsdoc-parser-enforces-body-cap", {
  kind: "Constant Bounds Checking",
  exports: [parseFileDirectives, enforceLengthCap],
});

/**
 * @spec.property jsdoc-escape-markdown-safe
 * @spec.kind Constant Bounds Checking
 * @spec.exports escapeForMarkdown
 * @spec.claim escaped output never introduces new markdown syntactic structure (backticks, code-fences, link syntax)
 */
itSpec.todo("jsdoc-escape-markdown-safe", {
  kind: "Constant Bounds Checking",
  exports: [escapeForMarkdown],
});

/**
 * @spec.property jsdoc-escape-yaml-safe
 * @spec.kind Constant Bounds Checking
 * @spec.exports escapeForYaml
 * @spec.claim escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes)
 */
itSpec.todo("jsdoc-escape-yaml-safe", {
  kind: "Constant Bounds Checking",
  exports: [escapeForYaml],
});

/**
 * @spec.property jsdoc-escape-json-safe
 * @spec.kind Constant Bounds Checking
 * @spec.exports escapeForJson
 * @spec.claim escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars)
 */
itSpec.todo("jsdoc-escape-json-safe", {
  kind: "Constant Bounds Checking",
  exports: [escapeForJson],
});
