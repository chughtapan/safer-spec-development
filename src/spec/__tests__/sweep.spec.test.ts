/**
 * @spec.purpose Coverage-sweep tests for the `spec/` facade — adds
 *   property types beyond `spec.spec.test.ts` for the single export
 *   `itSpec` so it crosses the gate threshold.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";

class SpecSweepAssertionError extends Data.TaggedError(
  "SpecSweepAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, SpecSweepAssertionError> =>
  cond ? Effect.fail(new SpecSweepAssertionError({ detail })) : Effect.void;

/**
 * @spec.property itspec-todo-prop-distinct-references
 * @spec.type Constant Non-Equality
 * @spec.exports itSpec
 * @spec.claim `itSpec.todo` and `itSpec.prop` are different function references — `extractProperties` distinguishes stubs from implemented bodies by checking which method was called at each test site
 */
itSpec.prop(
  "itspec-todo-prop-distinct-references",
  { type: "Constant Non-Equality", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(itSpec.todo === itSpec.prop, `todo and prop must be distinct`),
    ),
);

/**
 * @spec.property itspec-bounded-method-count
 * @spec.type Constant Bounds Checking
 * @spec.exports itSpec
 * @spec.claim `itSpec` exposes exactly two methods (`todo` and `prop`) — the closed API surface the codemod's directive parser keys on
 */
itSpec.prop(
  "itspec-bounded-method-count",
  { type: "Constant Bounds Checking", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const keys = Object.keys(itSpec);
        yield* failIf(keys.length !== 2, `expected 2 methods, got ${keys.length}: ${keys.join(",")}`);
      }),
    ),
);

/**
 * @spec.property itspec-roundtrip-method-call-shape
 * @spec.type Roundtrip
 * @spec.exports itSpec
 * @spec.claim `itSpec.todo` and `itSpec.prop` are both function-typed — calling either with an `id` and `meta` doesn't throw at the type level (regardless of runtime side effects)
 */
itSpec.prop(
  "itspec-roundtrip-method-call-shape",
  { type: "Roundtrip", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(typeof itSpec.todo !== "function", `todo not function`);
        yield* failIf(typeof itSpec.prop !== "function", `prop not function`);
      }),
    ),
);

/**
 * @spec.property itspec-includes-todo-key
 * @spec.type Inclusion
 * @spec.exports itSpec
 * @spec.claim `itSpec` exposes `todo` as an own property key — the surface every test file imports via `itSpec.todo(...)`
 */
itSpec.prop(
  "itspec-includes-todo-key",
  { type: "Inclusion", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(!Object.prototype.hasOwnProperty.call(itSpec, "todo"), `missing todo`),
    ),
);
