/**
 * @spec.purpose Property stubs for the canonical SPEC.md section emitter.
 *   Roundtrip: parse→serialize→parse stays stable. Inclusion: every section
 *   declared in the schema appears in output.
 */

import { itSpec } from "../../../kernel/index.js";
import {
  emitArchitectureSection,
  emitFilesSection,
  emitFrontmatter,
  emitPropertiesSection,
  emitPublicSurfaceSection,
  emitPurposeSection,
  emitSpec,
} from "../index.js";

itSpec.todo("section-emitter-roundtrip", {
  kind: "Roundtrip",
  exports: [emitSpec],
});

itSpec.todo("section-emitter-frontmatter-inclusion", {
  kind: "Inclusion",
  exports: [emitFrontmatter],
});

itSpec.todo("section-emitter-purpose-inclusion", {
  kind: "Inclusion",
  exports: [emitPurposeSection],
});

itSpec.todo("section-emitter-architecture-inclusion", {
  kind: "Inclusion",
  exports: [emitArchitectureSection],
});

itSpec.todo("section-emitter-public-surface-inclusion", {
  kind: "Inclusion",
  exports: [emitPublicSurfaceSection],
});

itSpec.todo("section-emitter-files-inclusion", {
  kind: "Inclusion",
  exports: [emitFilesSection],
});

itSpec.todo("section-emitter-properties-inclusion", {
  kind: "Inclusion",
  exports: [emitPropertiesSection],
});
