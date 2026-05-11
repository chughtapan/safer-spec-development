/**
 * @spec.purpose Property stubs for the SPEC.md frontmatter schema.
 */

import { itSpec } from "../helper.js";
import { SpecFrontmatterSchema } from "../frontmatter.js";

itSpec.todo("frontmatter-roundtrip", {
  kind: "Roundtrip",
  exports: [SpecFrontmatterSchema],
});

itSpec.todo("frontmatter-rejects-malformed", {
  kind: "Exception Raising",
  exports: [SpecFrontmatterSchema],
});

itSpec.todo("frontmatter-decoded-shape", {
  kind: "Typechecking",
  exports: [SpecFrontmatterSchema],
});
