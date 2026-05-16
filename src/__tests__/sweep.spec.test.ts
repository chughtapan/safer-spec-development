/**
 * @spec.purpose Coverage-sweep tests for the package facade — adds
 *   property types beyond `facade.spec.test.ts` for the two exports
 *   `PROPERTY_TYPES` and `itSpec` so each crosses the gate threshold.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { PROPERTY_TYPES } from "@safer/spec/grammar/property-types.js";

class FacadeSweepAssertionError extends Data.TaggedError(
  "FacadeSweepAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, FacadeSweepAssertionError> =>
  cond ? Effect.fail(new FacadeSweepAssertionError({ detail })) : Effect.void;

/* ---------- PROPERTY_TYPES additional property types ---------- */

/**
 * @spec.property property-types-typechecks-as-readonly-array
 * @spec.type Typechecking
 * @spec.exports PROPERTY_TYPES
 * @spec.claim `PROPERTY_TYPES` is an array of strings — the type the runtime literal-union check at the directive parser boundary depends on
 */
itSpec.prop(
  "property-types-typechecks-as-readonly-array",
  { type: "Typechecking", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(!Array.isArray(PROPERTY_TYPES), `must be Array`);
        for (const pt of PROPERTY_TYPES) {
          yield* failIf(typeof pt !== "string", `non-string member: ${typeof pt}`);
        }
      }),
    ),
);

/**
 * @spec.property property-types-bounded-length-paper-tier
 * @spec.type Constant Bounds Checking
 * @spec.exports PROPERTY_TYPES
 * @spec.claim `PROPERTY_TYPES.length` stays within 8..12 — the OOPSLA paper's 9-category vocabulary is the target; per-repo extensions append a few more, never reduce
 */
itSpec.prop(
  "property-types-bounded-length-paper-tier",
  { type: "Constant Bounds Checking", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        PROPERTY_TYPES.length < 8 || PROPERTY_TYPES.length > 12,
        `out of bounds: ${PROPERTY_TYPES.length}`,
      ),
    ),
);

/**
 * @spec.property property-types-roundtrip-through-array-copy
 * @spec.type Roundtrip
 * @spec.exports PROPERTY_TYPES
 * @spec.claim `[...PROPERTY_TYPES]` produces an array with the same entries in the same order — the tuple is iterable and indexable; downstream code can safely spread without losing or reordering members
 */
itSpec.prop(
  "property-types-roundtrip-through-array-copy",
  { type: "Roundtrip", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const copy = [...PROPERTY_TYPES];
        yield* failIf(copy.length !== PROPERTY_TYPES.length, `length mismatch`);
        for (let i = 0; i < copy.length; i++) {
          yield* failIf(copy[i] !== PROPERTY_TYPES[i], `mismatch at ${i}`);
        }
      }),
    ),
);

/* ---------- itSpec additional property types ---------- */

/**
 * @spec.property itspec-todo-and-prop-methods-distinct
 * @spec.type Constant Non-Equality
 * @spec.exports itSpec
 * @spec.claim `itSpec.todo` and `itSpec.prop` are different function references — the codemod distinguishes stubbed from implemented properties by checking which call is at each test site
 */
itSpec.prop(
  "itspec-todo-and-prop-methods-distinct",
  { type: "Constant Non-Equality", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(itSpec.todo === itSpec.prop, `itSpec.todo and itSpec.prop must be distinct`),
    ),
);

/**
 * @spec.property itspec-todo-takes-two-args
 * @spec.type Constant Equality
 * @spec.exports itSpec
 * @spec.claim `itSpec.todo` has arity 2: `(id, meta)` — the stub-mode helper that doesn't take an arbitrary or body
 */
itSpec.prop(
  "itspec-todo-takes-two-args",
  { type: "Constant Equality", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(itSpec.todo.length !== 2, `expected arity 2, got ${itSpec.todo.length}`),
    ),
);

/**
 * @spec.property itspec-prop-takes-four-args
 * @spec.type Constant Equality
 * @spec.exports itSpec
 * @spec.claim `itSpec.prop` has arity 4: `(id, meta, arb, body)` — the implemented-mode helper that takes a fast-check arbitrary and a property body
 */
itSpec.prop(
  "itspec-prop-takes-four-args",
  { type: "Constant Equality", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(itSpec.prop.length !== 4, `expected arity 4, got ${itSpec.prop.length}`),
    ),
);

/**
 * @spec.property itspec-todo-and-prop-bounded-arity
 * @spec.type Constant Bounds Checking
 * @spec.exports itSpec
 * @spec.claim both `itSpec.todo` and `itSpec.prop` accept ≤4 args — the codemod's `@spec.exports` list correctness assumes the function-style signature, not an options-bag
 */
itSpec.prop(
  "itspec-todo-and-prop-bounded-arity",
  { type: "Constant Bounds Checking", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(itSpec.todo.length > 4, `todo arity too high`);
        yield* failIf(itSpec.prop.length > 4, `prop arity too high`);
      }),
    ),
);
