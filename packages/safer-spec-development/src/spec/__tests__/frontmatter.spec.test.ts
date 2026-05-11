/**
 * @spec.purpose Property stubs for the SPEC.md frontmatter contract.
 *   Tests reference the public `decodeSpecFrontmatter` boundary; the
 *   underlying Schema constructor stays private to spec/frontmatter.ts.
 */

import { itSpec } from "@safer/authoring/index.js";
import { decodeSpecFrontmatter } from "@safer/spec/frontmatter.js";

/**
 * @spec.property frontmatter-roundtrip
 * @spec.kind Roundtrip
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim YAML emit(decode(yaml)) is byte-equal to the original well-formed yaml frontmatter block
 */
itSpec.todo("frontmatter-roundtrip", {
  kind: "Roundtrip",
  exports: [decodeSpecFrontmatter],
});

/**
 * @spec.property frontmatter-rejects-malformed
 * @spec.kind Exception Raising
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim malformed YAML fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.todo("frontmatter-rejects-malformed", {
  kind: "Exception Raising",
  exports: [decodeSpecFrontmatter],
});

/**
 * @spec.property frontmatter-decoded-shape
 * @spec.kind Typechecking
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim decoded frontmatter matches the declared SpecFrontmatter type at every branch
 */
itSpec.todo("frontmatter-decoded-shape", {
  kind: "Typechecking",
  exports: [decodeSpecFrontmatter],
});
