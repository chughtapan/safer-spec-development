/**
 * @spec.purpose
 *   Resolves backticked symbol references in SPEC.md body prose. Local
 *   source references use declaration locations; workspace references can
 *   resolve to sibling SPEC.md anchors. Cross-file source resolution is a
 *   separate resolver capability.
 *
 *   Tagged error `LinkResolutionError` is co-located here.
 *
 *   Resolution strategy is heuristic over the symbol shape:
 *     - Identifier starting with `@safer/` → `cross-spec` (sibling spec folder anchor).
 *     - Identifier matching the npm-package shape (`@scope/name` / lowercase
 *       package) → `external-package` (returns `UnresolvedExternal`, no failure).
 *     - Identifier matching `agent-code-guard/*` → `agent-code-guard-rule`.
 *     - Everything else → `intra-file` (local declaration).
 *
 *   The resolver classifies by shape only; it does NOT walk the AST. The
 *   build-time `validate` gate is responsible for fail-closed checking that
 *   intra-file symbols actually exist; this resolver returns the
 *   `LinkResolution` so the emit step can stamp an anchor.
 *
 *   Unresolved internal references resolve to `intra-file` placeholders
 *   that the validate gate inspects; unresolved external references
 *   return `UnresolvedExternal` (no failure). Per-export guarantees are
 *   on the individual exports below.
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

const CROSS_SPEC_PREFIX = "@safer/";
const AGENT_RULE_PREFIX = "agent-code-guard/";
const SCOPED_PACKAGE_RE = /^@[a-z][a-z0-9-]*\/[a-z0-9-]+/;
const BARE_PACKAGE_RE = /^[a-z][a-z0-9-]*(\/[a-z0-9-]+)?$/;

const classify = (symbol: string): ResolutionOrigin => {
  if (symbol.startsWith(CROSS_SPEC_PREFIX)) return "cross-spec";
  if (symbol.startsWith(AGENT_RULE_PREFIX)) return "agent-code-guard-rule";
  if (SCOPED_PACKAGE_RE.test(symbol)) return "external-package";
  if (BARE_PACKAGE_RE.test(symbol) && symbol.length > 1) return "external-package";
  return "intra-file";
};

const hrefFor = (symbol: string, origin: ResolutionOrigin): string => {
  switch (origin) {
    case "cross-spec": {
      const after = symbol.slice(CROSS_SPEC_PREFIX.length);
      const folderEnd = after.indexOf("/");
      const folder = folderEnd === -1 ? after : after.slice(0, folderEnd);
      return `../${folder}/SPEC.md`;
    }
    case "agent-code-guard-rule": {
      const rule = symbol.slice(AGENT_RULE_PREFIX.length);
      return `https://github.com/anthropics/eslint-plugin-agent-code-guard#${rule}`;
    }
    case "intra-file":
      return `#${symbol.toLowerCase()}`;
    case "external-package":
      return "";
  }
};

/**
 * @spec.guarantee "returns LinkResolution for intra-file, cross-spec, and agent-code-guard-rule; UnresolvedExternal (no failure) for external-package"
 *   reason: external misses are silent by design; only internal drift
 *           fails the build.
 * @spec.residual-contract "anchor sha is null at resolve time; emit step is responsible for stamping the git short-sha when it renders the anchor"
 *   reason: durability contract for code-reference pinning; resolver is
 *           pure and does not shell out to git.
 */
export const resolveSymbol = (
  symbol: string,
  _fromFile: string,
): Effect.Effect<LinkOutcome, LinkResolutionError> =>
  Effect.sync(() => {
    const origin = classify(symbol);
    if (origin === "external-package") {
      const outcome: UnresolvedExternal = {
        symbol,
        origin,
        reason: "external package symbol; not resolved at codemod time",
      };
      return outcome;
    }
    const outcome: LinkResolution = {
      symbol,
      origin,
      href: hrefFor(symbol, origin),
      anchorSha: null,
    };
    return outcome;
  });

/**
 * Path-relative-to-folder for source links inside `&lt;folder>/SPEC.md`.
 * Same-folder: `./name.ts`. Cross-folder: `../...`. Absolute/external:
 * passthrough.
 */
export const relativeToFolder = (folder: string, target: string): string => {
  // Project-root sentinel: a SPEC.md at the repo root reaches every file
  // via `./<target>`. Treating `.` as one path segment would emit `../…`
  // and point outside the repo.
  if (folder === ".") return "./" + target.replace(/^\.?\/?/, "");
  const prefix = folder + "/";
  if (target.startsWith(prefix)) return "./" + target.slice(prefix.length);
  if (target.startsWith("/") || /^[a-zA-Z]+:/.test(target)) return target;
  const fromParts = folder.split("/").filter((s) => s.length > 0);
  const toParts = target.split("/").filter((s) => s.length > 0);
  let shared = 0;
  while (
    shared < fromParts.length && shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) shared += 1;
  return "../".repeat(fromParts.length - shared) + toParts.slice(shared).join("/");
};
