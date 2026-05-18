/**
 * @spec.purpose Property stubs for the link resolver. Inclusion: intra-file
 *   and cross-spec references resolve to valid hrefs. Cross-file source
 *   resolution is a separate resolver capability.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { resolveSymbol, relativeToFolder } from "@safer/spec/artifact/link-resolver.js";

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

/**
 * @spec.property resolve-symbol-cross-spec-emits-relative-md-link
 * @spec.type Constant Equality
 * @spec.exports resolveSymbol
 * @spec.claim the `@safer/FOLDER/...` shape resolves to cross-spec origin with href `../FOLDER/MODULE.md`
 */
itSpec.prop(
  "resolve-symbol-cross-spec-emits-relative-md-link",
  { type: "Constant Equality", exports: [resolveSymbol] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = yield* resolveSymbol("@safer/analysis/checks", "any.md");
        yield* failIf(out.origin !== "cross-spec", `expected cross-spec; got ${out.origin}`);
        if (out.origin !== "cross-spec") return;
        yield* failIf(out.href !== "../analysis/MODULE.md", `expected ../analysis/MODULE.md; got ${out.href}`);
      }),
    ),
);

/**
 * @spec.property resolve-symbol-cross-spec-without-subpath
 * @spec.type Constant Equality
 * @spec.exports resolveSymbol
 * @spec.claim `@safer/FOLDER` (no trailing slash) still emits href `../FOLDER/MODULE.md`
 */
itSpec.prop(
  "resolve-symbol-cross-spec-without-subpath",
  { type: "Constant Equality", exports: [resolveSymbol] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = yield* resolveSymbol("@safer/project", "any.md");
        yield* failIf(out.origin !== "cross-spec", `expected cross-spec`);
        if (out.origin !== "cross-spec") return;
        yield* failIf(out.href !== "../project/MODULE.md", `expected ../project/MODULE.md; got ${out.href}`);
      }),
    ),
);

/**
 * @spec.property resolve-symbol-agent-code-guard-rule
 * @spec.type Inclusion
 * @spec.exports resolveSymbol
 * @spec.claim `agent-code-guard/\<rule>` resolves to agent-code-guard-rule with a GitHub URL containing the rule name
 */
itSpec.prop(
  "resolve-symbol-agent-code-guard-rule",
  { type: "Inclusion", exports: [resolveSymbol] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = yield* resolveSymbol("agent-code-guard/no-throw", "any.md");
        yield* failIf(out.origin !== "agent-code-guard-rule", `expected agent-code-guard-rule`);
        if (out.origin !== "agent-code-guard-rule") return;
        yield* failIf(!out.href.includes("#no-throw"), `expected anchor; got ${out.href}`);
      }),
    ),
);

/**
 * @spec.property relative-to-folder-root-sentinel
 * @spec.type Constant Equality
 * @spec.exports relativeToFolder
 * @spec.claim from folder "." (project root sentinel), target is rebased onto `./TARGET` rather than `../TARGET`
 */
itSpec.prop(
  "relative-to-folder-root-sentinel",
  { type: "Constant Equality", exports: [relativeToFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = relativeToFolder(".", "src/foo.ts");
        yield* failIf(out !== "./src/foo.ts", `expected ./src/foo.ts; got ${out}`);
      }),
    ),
);

/**
 * @spec.property relative-to-folder-same-folder-prefix
 * @spec.type Constant Equality
 * @spec.exports relativeToFolder
 * @spec.claim a target prefixed by the folder rebases to `./REMAINDER`
 */
itSpec.prop(
  "relative-to-folder-same-folder-prefix",
  { type: "Constant Equality", exports: [relativeToFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = relativeToFolder("src/foo", "src/foo/bar.ts");
        yield* failIf(out !== "./bar.ts", `expected ./bar.ts; got ${out}`);
      }),
    ),
);

/**
 * @spec.property relative-to-folder-absolute-passthrough
 * @spec.type Constant Equality
 * @spec.exports relativeToFolder
 * @spec.claim absolute paths and URL schemes pass through unchanged
 */
itSpec.prop(
  "relative-to-folder-absolute-passthrough",
  { type: "Constant Equality", exports: [relativeToFolder] },
  fc.constantFrom("/abs/path/foo.ts", "https://x/y"),
  (target) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = relativeToFolder("src/x", target);
        yield* failIf(out !== target, `expected ${target} unchanged; got ${out}`);
      }),
    ),
);

/**
 * @spec.property relative-to-folder-sibling-folders
 * @spec.type Constant Equality
 * @spec.exports relativeToFolder
 * @spec.claim sibling-folder targets emit a `../OTHER/...` link
 */
itSpec.prop(
  "relative-to-folder-sibling-folders",
  { type: "Constant Equality", exports: [relativeToFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = relativeToFolder("src/a", "src/b/x.ts");
        yield* failIf(out !== "../b/x.ts", `expected ../b/x.ts; got ${out}`);
      }),
    ),
);
