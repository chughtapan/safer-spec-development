/**
 * @spec.purpose Property stubs for the link resolver. Inclusion: intra-file
 *   and cross-spec references resolve to valid hrefs. Cross-file resolution
 *   is deferred per design doc Open Question 6.
 */

import { itSpec } from "@safer/authoring/index.js";
import { resolveSymbol } from "@safer/source/link-resolver.js";

/**
 * @spec.property link-resolver-intra-file-anchor-pinned
 * @spec.kind Inclusion
 * @spec.exports resolveSymbol
 * @spec.claim every intra-file resolution returns href with a non-null sha-pinned anchor
 */
itSpec.todo("link-resolver-intra-file-anchor-pinned", {
  kind: "Inclusion",
  exports: [resolveSymbol],
});

/**
 * @spec.property link-resolver-fails-internal-misses
 * @spec.kind Exception Raising
 * @spec.exports resolveSymbol
 * @spec.claim unresolved internal references fail with LinkResolutionError; external misses return UnresolvedExternal
 */
itSpec.todo("link-resolver-fails-internal-misses", {
  kind: "Exception Raising",
  exports: [resolveSymbol],
});
