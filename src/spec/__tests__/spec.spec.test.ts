/**
 * @spec.purpose Property tests for `spec/`'s author-facing surface. The
 *   folder barrel re-exports `itSpec` (the test-author runtime) from
 *   `spec/grammar/it-spec.ts`. Tests assert the shape of `itSpec` — its
 *   methods, their signatures, and the consistency between the runtime
 *   value and the `ItSpec` interface it implements.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "../index.js";

class SpecAssertionError extends Data.TaggedError("SpecAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, SpecAssertionError> =>
  cond ? Effect.fail(new SpecAssertionError({ detail })) : Effect.void;

/**
 * @spec.property itspec-exposes-todo-and-prop-methods
 * @spec.type Inclusion
 * @spec.exports itSpec
 * @spec.claim `itSpec` exposes exactly the methods `todo` and `prop` — the two-shape author API the codemod's cross-check expects to find at every itSpec call site
 */
itSpec.prop(
  "itspec-exposes-todo-and-prop-methods",
  { type: "Inclusion", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const keys = Object.keys(itSpec);
        yield* failIf(
          !keys.includes("todo") || !keys.includes("prop"),
          `itSpec must expose 'todo' and 'prop' methods; got keys: ${JSON.stringify(keys)}`,
        );
      }),
    ),
);

/**
 * @spec.property itspec-todo-and-prop-are-functions
 * @spec.type Typechecking
 * @spec.exports itSpec
 * @spec.claim `itSpec.todo` and `itSpec.prop` are both functions — the runtime shape downstream test authors call
 */
itSpec.prop(
  "itspec-todo-and-prop-are-functions",
  { type: "Typechecking", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(
          typeof itSpec.todo !== "function",
          `itSpec.todo must be a function; got ${typeof itSpec.todo}`,
        );
        yield* failIf(
          typeof itSpec.prop !== "function",
          `itSpec.prop must be a function; got ${typeof itSpec.prop}`,
        );
      }),
    ),
);

/**
 * @spec.property itspec-todo-arity
 * @spec.type Constant Equality
 * @spec.exports itSpec
 * @spec.claim `itSpec.todo` has arity 2 (id, meta) — matching the documented `ItSpec["todo"]` signature
 */
itSpec.prop(
  "itspec-todo-arity",
  { type: "Constant Equality", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        itSpec.todo.length !== 2,
        `itSpec.todo must have arity 2; got ${itSpec.todo.length}`,
      ),
    ),
);

/**
 * @spec.property itspec-prop-arity
 * @spec.type Constant Equality
 * @spec.exports itSpec
 * @spec.claim `itSpec.prop` has arity 4 (id, meta, arb, body) — matching the documented `ItSpec["prop"]` signature
 */
itSpec.prop(
  "itspec-prop-arity",
  { type: "Constant Equality", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        itSpec.prop.length !== 4,
        `itSpec.prop must have arity 4; got ${itSpec.prop.length}`,
      ),
    ),
);
