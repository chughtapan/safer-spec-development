/**
 * @spec.purpose
 *   Resolves backticked symbol references in SPEC.md body prose. Stage 1
 *   covers two resolvers: intra-file (`symbol.getDeclarations()[0]` →
 *   `[Symbol](../../path.ts#Lnn)`) and cross-spec (workspace sibling
 *   `[Symbol](../../sibling/src/folder/SPEC.md#symbol-slug)`). Cross-file
 *   resolution is deferred per design doc Open Question 6.
 *
 * @spec.guarantee Unresolved internal references fail the build with
 *   `LinkResolutionError`; unresolved external references are silent.
 *   reason: internal drift is correctable in-repo; external misses depend on
 *           foreign-package shapes outside our control.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { LinkResolutionError } from "../../errors/index.js";

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

export const resolveSymbol = (
  _symbol: string,
  _fromFile: string,
): Effect.Effect<LinkOutcome, LinkResolutionError> =>
  Eff.die(new Error("Stage 1 stub: resolveSymbol not implemented"));
