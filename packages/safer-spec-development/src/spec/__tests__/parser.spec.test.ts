/**
 * @spec.purpose Property stubs for the JSDoc directive parser and its
 *   escape-on-emit helpers. Rejects unknown directives; rejects oversize
 *   bodies; the parsed AST matches the closed grammar in `directives.ts`;
 *   escape helpers preserve safe substitution into Markdown / YAML / JSON.
 */

import { itSpec } from "../../../kernel/index.js";
import {
  enforceLengthCap,
  escapeForJson,
  escapeForMarkdown,
  escapeForYaml,
  parseFileDirectives,
} from "../index.js";

itSpec.todo("jsdoc-parser-rejects-unknown-directive", {
  kind: "Exception Raising",
  exports: [parseFileDirectives],
});

itSpec.todo("jsdoc-parser-ast-typechecks", {
  kind: "Typechecking",
  exports: [parseFileDirectives],
});

itSpec.todo("jsdoc-parser-enforces-body-cap", {
  kind: "Constant Bounds Checking",
  exports: [parseFileDirectives, enforceLengthCap],
});

itSpec.todo("jsdoc-escape-markdown-safe", {
  kind: "Constant Bounds Checking",
  exports: [escapeForMarkdown],
});

itSpec.todo("jsdoc-escape-yaml-safe", {
  kind: "Constant Bounds Checking",
  exports: [escapeForYaml],
});

itSpec.todo("jsdoc-escape-json-safe", {
  kind: "Constant Bounds Checking",
  exports: [escapeForJson],
});
