/**
 * @specPurpose Property stubs for the SPEC.md frontmatter contract.
 *   Tests reference the public `decodeSpecFrontmatter` boundary; the
 *   underlying Schema constructor stays private to spec/frontmatter.ts.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { decodeSpecFrontmatter } from "@safer/spec/frontmatter.js";

/**
 * @specProperty frontmatter-roundtrip
 * @specType Roundtrip
 * @specExports decodeSpecFrontmatter
 * @specClaim YAML emit(decode(yaml)) is byte-equal to the original well-formed yaml frontmatter block
 */
itSpec.todo("frontmatter-roundtrip", {
  type: "Roundtrip",
  exports: [decodeSpecFrontmatter],
});

/**
 * @specProperty frontmatter-rejects-malformed
 * @specType Exception Raising
 * @specExports decodeSpecFrontmatter
 * @specClaim malformed YAML fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.todo("frontmatter-rejects-malformed", {
  type: "Exception Raising",
  exports: [decodeSpecFrontmatter],
});

/**
 * @specProperty frontmatter-decoded-shape
 * @specType Typechecking
 * @specExports decodeSpecFrontmatter
 * @specClaim decoded frontmatter matches the declared SpecFrontmatter type at every branch
 */
itSpec.todo("frontmatter-decoded-shape", {
  type: "Typechecking",
  exports: [decodeSpecFrontmatter],
});
