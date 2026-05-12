/**
 * @spec.purpose Property stubs for the SPEC.md frontmatter contract.
 *   Tests reference the public `decodeSpecFrontmatter` boundary; the
 *   underlying Schema constructor stays private to spec/frontmatter.ts.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { decodeSpecFrontmatter } from "@safer/spec/frontmatter.js";

/**
 * @spec.property frontmatter-roundtrip
 * @spec.type Roundtrip
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim YAML emit(decode(yaml)) is byte-equal to the original well-formed yaml frontmatter block
 */
itSpec.todo("frontmatter-roundtrip", {
  type: "Roundtrip",
  exports: [decodeSpecFrontmatter],
});

/**
 * @spec.property frontmatter-rejects-malformed
 * @spec.type Exception Raising
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim malformed YAML fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.todo("frontmatter-rejects-malformed", {
  type: "Exception Raising",
  exports: [decodeSpecFrontmatter],
});

/**
 * @spec.property frontmatter-decoded-shape
 * @spec.type Typechecking
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim decoded frontmatter matches the declared SpecFrontmatter type at every branch
 */
itSpec.todo("frontmatter-decoded-shape", {
  type: "Typechecking",
  exports: [decodeSpecFrontmatter],
});

/**
 * @spec.property frontmatter-decode-preserves-format-version
 * @spec.type Inclusion
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim every emitted SPEC.md carries `format-version: &lt;SPEC_FORMAT_VERSION>` in its YAML block and the decode boundary preserves that field on the decoded value (no silent strip during the schema decode)
 */
itSpec.todo("frontmatter-decode-preserves-format-version", {
  type: "Inclusion",
  exports: [decodeSpecFrontmatter],
});
