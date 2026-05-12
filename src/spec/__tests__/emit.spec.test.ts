/**
 * @spec.purpose Property stubs for the canonical SPEC.md section emitter.
 *   Roundtrip: parse→serialize→parse stays stable. Inclusion: every section
 *   in the emitted output is present.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { emitMarkdown } from "@safer/spec/emit.js";

/**
 * @spec.property emit-sha-stable
 * @spec.type Roundtrip
 * @spec.exports emitMarkdown
 * @spec.claim two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha
 */
itSpec.todo("emit-sha-stable", {
  type: "Roundtrip",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-section-order-fixed
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture
 */
itSpec.todo("emit-section-order-fixed", {
  type: "Inclusion",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-canonical-line-endings
 * @spec.type Constant Equality
 * @spec.exports emitMarkdown
 * @spec.claim emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed
 */
itSpec.todo("emit-canonical-line-endings", {
  type: "Constant Equality",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-frontmatter-roundtrips
 * @spec.type Roundtrip
 * @spec.exports emitMarkdown
 * @spec.claim YAML frontmatter parsed from emitMarkdown output round-trips back to the same SpecFrontmatter shape
 */
itSpec.todo("emit-frontmatter-roundtrips", {
  type: "Roundtrip",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-public-surface-source-order
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim Public surface section lists exports in source-order (matching the file's declaration order)
 */
itSpec.todo("emit-public-surface-source-order", {
  type: "Inclusion",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-files-section-lex-sorted
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim Files section lists sibling filenames in lexicographic order
 */
itSpec.todo("emit-files-section-lex-sorted", {
  type: "Inclusion",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-residual-bodies-escaped
 * @spec.type Constant Bounds Checking
 * @spec.exports emitMarkdown
 * @spec.claim residual-contract bodies emitted into markdown go through escapeForMarkdown; no injection
 */
itSpec.todo("emit-residual-bodies-escaped", {
  type: "Constant Bounds Checking",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-children-section-mixes-subfolders-files-tests
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim `## Children` lists immediate SPEC'd subfolders (linking to `&lt;sub>/SPEC.md`) before source files before tests; each row carries the file or subfolder `@spec.purpose` body when present
 */
itSpec.todo("emit-children-section-mixes-subfolders-files-tests", {
  type: "Inclusion",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-root-folder-spec-links-stay-in-repo
 * @spec.type Constant Equality
 * @spec.exports emitMarkdown
 * @spec.claim a SPEC.md at the repo root (`folder === "."`) reaches every file via `./&lt;target>`; `relativeToFolder` never emits `../...` for the root sentinel
 */
itSpec.todo("emit-root-folder-spec-links-stay-in-repo", {
  type: "Constant Equality",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-properties-table-cells-are-code-span-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports emitMarkdown
 * @spec.claim a backtick (or other markdown markup) inside a property `id` / `exports` cell never closes the surrounding code span; the table grammar (column count, row terminator) survives any author-controlled directive content
 */
itSpec.todo("emit-properties-table-cells-are-code-span-safe", {
  type: "Constant Bounds Checking",
  exports: [emitMarkdown],
});

/**
 * @spec.property emit-file-purpose-rendered-with-link
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim every entry in `## Children` for a file with a top-of-file `@spec.purpose` renders as `[\`&lt;rel-path>\`](./&lt;rel-path>) — &lt;purpose body>`; files without `@spec.purpose` render as link-only
 */
itSpec.todo("emit-file-purpose-rendered-with-link", {
  type: "Inclusion",
  exports: [emitMarkdown],
});
