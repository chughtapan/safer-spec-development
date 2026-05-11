/**
 * @specPurpose Property stubs for the link resolver. Inclusion: intra-file
 *   and cross-spec references resolve to valid hrefs. Cross-file source
 *   resolution is a separate resolver capability.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { resolveSymbol } from "@safer/spec/link-resolver.js";

/**
 * @specProperty link-resolver-intra-file-anchor-pinned
 * @specType Inclusion
 * @specExports resolveSymbol
 * @specClaim every intra-file resolution returns href with a non-null sha-pinned anchor
 */
itSpec.todo("link-resolver-intra-file-anchor-pinned", {
  type: "Inclusion",
  exports: [resolveSymbol],
});

/**
 * @specProperty link-resolver-fails-internal-misses
 * @specType Exception Raising
 * @specExports resolveSymbol
 * @specClaim unresolved internal references fail with LinkResolutionError; external misses return UnresolvedExternal
 */
itSpec.todo("link-resolver-fails-internal-misses", {
  type: "Exception Raising",
  exports: [resolveSymbol],
});
