/**
 * @spec.purpose Property stubs for the SPEC.md frontmatter contract.
 *   Tests reference the public `decodeSpecFrontmatter` boundary; the
 *   underlying Schema constructor stays private to kernel/frontmatter.ts.
 */

import { itSpec } from "../kernel/index.js";
import { decodeSpecFrontmatter } from "../kernel/index.js";

itSpec.todo("frontmatter-roundtrip", {
  kind: "Roundtrip",
  exports: [decodeSpecFrontmatter],
});

itSpec.todo("frontmatter-rejects-malformed", {
  kind: "Exception Raising",
  exports: [decodeSpecFrontmatter],
});

itSpec.todo("frontmatter-decoded-shape", {
  kind: "Typechecking",
  exports: [decodeSpecFrontmatter],
});
