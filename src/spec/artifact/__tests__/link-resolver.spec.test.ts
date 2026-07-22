/**
 * @spec.purpose Property stubs for the source-link path rebaser
 *   (`relativeToFolder`): root sentinel, same-folder prefix, absolute
 *   passthrough, and sibling-folder `../` walks.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { relativeToFolder } from "@safer/spec/artifact/link-resolver.js";

class LinkAssertionError extends Data.TaggedError("LinkAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, LinkAssertionError> =>
  cond ? Effect.fail(new LinkAssertionError({ detail })) : Effect.void;

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
