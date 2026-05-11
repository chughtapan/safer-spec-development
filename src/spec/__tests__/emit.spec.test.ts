/**
 * @specPurpose Property stubs for the canonical SPEC.md section emitter.
 *   Roundtrip: parse→serialize→parse stays stable. Inclusion: every section
 *   in the emitted output is present.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { emitMarkdown } from "@safer/spec/emit.js";

/**
 * @specProperty emit-sha-stable
 * @specType Roundtrip
 * @specExports emitMarkdown
 * @specClaim two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha
 */
itSpec.todo("emit-sha-stable", {
  type: "Roundtrip",
  exports: [emitMarkdown],
});

/**
 * @specProperty emit-section-order-fixed
 * @specType Inclusion
 * @specExports emitMarkdown
 * @specClaim emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture
 */
itSpec.todo("emit-section-order-fixed", {
  type: "Inclusion",
  exports: [emitMarkdown],
});

/**
 * @specProperty emit-canonical-line-endings
 * @specType Constant Equality
 * @specExports emitMarkdown
 * @specClaim emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed
 */
itSpec.todo("emit-canonical-line-endings", {
  type: "Constant Equality",
  exports: [emitMarkdown],
});

/**
 * @specProperty emit-frontmatter-roundtrips
 * @specType Roundtrip
 * @specExports emitMarkdown
 * @specClaim YAML frontmatter parsed from emitMarkdown output round-trips back to the same SpecFrontmatter shape
 */
itSpec.todo("emit-frontmatter-roundtrips", {
  type: "Roundtrip",
  exports: [emitMarkdown],
});

/**
 * @specProperty emit-public-surface-source-order
 * @specType Inclusion
 * @specExports emitMarkdown
 * @specClaim Public surface section lists exports in source-order (matching the file's declaration order)
 */
itSpec.todo("emit-public-surface-source-order", {
  type: "Inclusion",
  exports: [emitMarkdown],
});

/**
 * @specProperty emit-files-section-lex-sorted
 * @specType Inclusion
 * @specExports emitMarkdown
 * @specClaim Files section lists sibling filenames in lexicographic order
 */
itSpec.todo("emit-files-section-lex-sorted", {
  type: "Inclusion",
  exports: [emitMarkdown],
});

/**
 * @specProperty emit-residual-bodies-escaped
 * @specType Constant Bounds Checking
 * @specExports emitMarkdown
 * @specClaim residual-contract bodies emitted into markdown go through escapeForMarkdown; no injection
 */
itSpec.todo("emit-residual-bodies-escaped", {
  type: "Constant Bounds Checking",
  exports: [emitMarkdown],
});
