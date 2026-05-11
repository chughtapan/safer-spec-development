/**
 * @spec.purpose Property stubs for the link resolver. Inclusion: intra-file
 *   and cross-spec references resolve to valid hrefs. Cross-file resolution
 *   is deferred per design doc Open Question 6 and is not stubbed.
 */

import { itSpec } from "../../../kernel/index.js";
import { resolveSymbol } from "../index.js";

itSpec.todo("link-resolver-intra-file-inclusion", {
  kind: "Inclusion",
  exports: [resolveSymbol],
});

itSpec.todo("link-resolver-cross-spec-inclusion", {
  kind: "Inclusion",
  exports: [resolveSymbol],
});
