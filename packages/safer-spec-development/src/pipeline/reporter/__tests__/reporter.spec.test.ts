/**
 * @spec.purpose Property stubs for the Vitest reporter + sidecar writer.
 *   Roundtrip: written JSON decodes back to the same SpecArtifact value.
 *   Constant Bounds Checking: escape-on-emit enforces the directive-body cap.
 */

import { itSpec } from "../../../kernel/index.js";
import { serializeSidecar, writeSidecar } from "../index.js";

itSpec.todo("sidecar-writer-roundtrip", {
  kind: "Roundtrip",
  exports: [serializeSidecar, writeSidecar],
});

itSpec.todo("sidecar-writer-escape-bounds", {
  kind: "Constant Bounds Checking",
  exports: [serializeSidecar],
});
