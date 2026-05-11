/**
 * @spec.purpose
 *   Resolves backticked symbol references in SPEC.md body prose. Local
 *   source references use declaration locations; workspace references can
 *   resolve to sibling SPEC.md anchors. Cross-file source resolution is a
 *   separate resolver capability.
 *
 *   Tagged error `LinkResolutionError` is co-located here.
 *
 * @spec.guarantee Unresolved internal references fail the build with
 *   `LinkResolutionError`; unresolved external references are silent.
 *   reason: internal drift is correctable in-repo; external misses depend on
 *           foreign-package shapes outside our control.
 */

import { Data, Effect } from "effect";

export class LinkResolutionError extends Data.TaggedError("LinkResolutionError")<{
  readonly symbol: string;
  readonly origin: string;
  readonly reason: string;
}> {}

type ResolutionOrigin =
  | "intra-file"
  | "cross-spec"
  | "agent-code-guard-rule"
  | "external-package";

interface LinkResolution {
  readonly symbol: string;
  readonly origin: ResolutionOrigin;
  readonly href: string;
  readonly anchorSha: string | null;
}

interface UnresolvedExternal {
  readonly symbol: string;
  readonly origin: "external-package";
  readonly reason: string;
}

type LinkOutcome = LinkResolution | UnresolvedExternal;

/**
 * @spec.guarantee "returns LinkResolution with sha-pinned anchor for intra-file and cross-spec; UnresolvedExternal (no failure) for external-package"
 *   reason: external misses are silent by design; only internal drift
 *           fails the build.
 * @spec.residual-contract "anchor sha is the git short-sha at the time the link is rendered; downstream readers can resolve via `git show <sha>:<path>`"
 *   reason: durability contract for code-reference pinning per
 *           PRINCIPLES.md "Code references are pinned".
 */
export const resolveSymbol = (
  _symbol: string,
  _fromFile: string,
): Effect.Effect<LinkOutcome, LinkResolutionError> =>
  Effect.die(new Error("Not implemented: resolveSymbol"));
