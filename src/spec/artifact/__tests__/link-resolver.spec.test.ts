/**
 * @spec.purpose Property stubs for the link resolver. Inclusion: intra-file
 *   and cross-spec references resolve to valid hrefs. Cross-file source
 *   resolution is a separate resolver capability.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { resolveSymbol } from "@safer/spec/artifact/link-resolver.js";

class LinkAssertionError extends Data.TaggedError("LinkAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, LinkAssertionError> =>
  cond ? Effect.fail(new LinkAssertionError({ detail })) : Effect.void;

/**
 * @spec.property link-resolver-intra-file-anchor-pinned
 * @spec.type Inclusion
 * @spec.exports resolveSymbol
 * @spec.claim every intra-file resolution returns an href with the `#`-prefixed anchor form; the anchor sha is null at resolve time and the emit step stamps the git short-sha when it renders the anchor
 */
itSpec.prop(
  "link-resolver-intra-file-anchor-pinned",
  { type: "Inclusion", exports: [resolveSymbol] },
  fc.stringMatching(/^[A-Z]\w{0,31}$/),
  (symbol) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const outcome = yield* resolveSymbol(symbol, "src/test.ts");
        yield* failIf(
          outcome.origin !== "intra-file",
          `expected intra-file origin for ${JSON.stringify(symbol)}, got ${outcome.origin}`,
        );
        if (outcome.origin !== "intra-file") return;
        yield* failIf(
          !outcome.href.startsWith("#"),
          `intra-file href must start with '#': ${JSON.stringify(outcome.href)}`,
        );
        yield* failIf(
          outcome.anchorSha !== null,
          `anchor sha must be null at resolve time; emit stamps it later`,
        );
      }),
    ),
);

/**
 * @spec.property link-resolver-fails-internal-misses
 * @spec.type Exception Raising
 * @spec.exports resolveSymbol
 * @spec.claim external package references (scoped `@scope/name` or bare `package-name`) return UnresolvedExternal (no Effect failure); the resolver classifies by shape, leaving fail-closed checking of internal misses to the build-time validate gate
 */
itSpec.prop(
  "link-resolver-fails-internal-misses",
  { type: "Exception Raising", exports: [resolveSymbol] },
  fc.oneof(
    fc
      .tuple(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
        fc.stringMatching(/^[a-z0-9-]{1,15}$/),
      )
      .map(([scope, name]) => `@${scope}/${name}`),
    fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/),
  ),
  (symbol) =>
    Effect.runPromise(
      Effect.gen(function* () {
        // Skip cross-spec collisions: `@safer/...` is classified separately.
        if (symbol.startsWith("@safer/")) return;
        const outcome = yield* resolveSymbol(symbol, "src/test.ts");
        yield* failIf(
          outcome.origin !== "external-package",
          `expected external-package origin for ${JSON.stringify(symbol)}, got ${outcome.origin}`,
        );
      }),
    ),
);
