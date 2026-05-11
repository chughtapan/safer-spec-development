/**
 * @spec.purpose Property stubs for the canonical SPEC.md section emitter.
 *   Roundtrip: parse→serialize→parse stays stable. Inclusion: every section
 *   in the emitted output is present.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { emitSpec } from "@safer/spec/emit.js";

/**
 * @spec.property emit-sha-stable
 * @spec.type Roundtrip
 * @spec.exports emitSpec
 * @spec.claim two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha
 */
itSpec.todo("emit-sha-stable", {
  type: "Roundtrip",
  exports: [emitSpec],
});

/**
 * @spec.property emit-section-order-fixed
 * @spec.type Inclusion
 * @spec.exports emitSpec
 * @spec.claim emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture
 */
itSpec.todo("emit-section-order-fixed", {
  type: "Inclusion",
  exports: [emitSpec],
});

/**
 * @spec.property emit-canonical-line-endings
 * @spec.type Constant Equality
 * @spec.exports emitSpec
 * @spec.claim emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed
 */
itSpec.todo("emit-canonical-line-endings", {
  type: "Constant Equality",
  exports: [emitSpec],
});

/**
 * @spec.property emit-frontmatter-roundtrips
 * @spec.type Roundtrip
 * @spec.exports emitSpec
 * @spec.claim YAML frontmatter parsed from emitSpec output round-trips back to the same SpecFrontmatter shape
 */
itSpec.todo("emit-frontmatter-roundtrips", {
  type: "Roundtrip",
  exports: [emitSpec],
});

/**
 * @spec.property emit-public-surface-source-order
 * @spec.type Inclusion
 * @spec.exports emitSpec
 * @spec.claim Public surface section lists exports in source-order (matching the file's declaration order)
 */
itSpec.todo("emit-public-surface-source-order", {
  type: "Inclusion",
  exports: [emitSpec],
});

/**
 * @spec.property emit-files-section-lex-sorted
 * @spec.type Inclusion
 * @spec.exports emitSpec
 * @spec.claim Files section lists sibling filenames in lexicographic order
 */
itSpec.todo("emit-files-section-lex-sorted", {
  type: "Inclusion",
  exports: [emitSpec],
});

/**
 * @spec.property emit-residual-bodies-escaped
 * @spec.type Constant Bounds Checking
 * @spec.exports emitSpec
 * @spec.claim residual-contract bodies emitted into markdown go through escapeForMarkdown; no injection
 */
itSpec.todo("emit-residual-bodies-escaped", {
  type: "Constant Bounds Checking",
  exports: [emitSpec],
});
