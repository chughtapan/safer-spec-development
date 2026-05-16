/**
 * @spec.purpose Property tests for the package's library facade
 *   (`src/index.ts`). The facade re-exports `PROPERTY_TYPES` + `itSpec`
 *   as the test-author surface; downstream packages import these via
 *   `@chughtapan/safer-spec-development`. Tests assert the closed
 *   property-type taxonomy (9 OOPSLA-significant kinds) is intact and
 *   the `itSpec` re-export resolves to the runtime helper.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec, PROPERTY_TYPES, type PropertyType } from "../index.js";

class FacadeAssertionError extends Data.TaggedError("FacadeAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, FacadeAssertionError> =>
  cond ? Effect.fail(new FacadeAssertionError({ detail })) : Effect.void;

/**
 * @spec.property property-types-has-nine-kinds
 * @spec.type Constant Equality
 * @spec.exports PROPERTY_TYPES
 * @spec.claim the closed OOPSLA property-type taxonomy has exactly 9 entries — the size validate's typeCoverage gate divides by
 */
itSpec.prop(
  "property-types-has-nine-kinds",
  { type: "Constant Equality", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        PROPERTY_TYPES.length !== 9,
        `PROPERTY_TYPES must have 9 entries; got ${PROPERTY_TYPES.length}`,
      ),
    ),
);

/**
 * @spec.property property-types-includes-roundtrip-and-inclusion
 * @spec.type Inclusion
 * @spec.exports PROPERTY_TYPES
 * @spec.claim PROPERTY_TYPES contains both `Roundtrip` and `Inclusion` — the two OOPSLA staples test authors reach for first
 */
itSpec.prop(
  "property-types-includes-roundtrip-and-inclusion",
  { type: "Inclusion", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const members: ReadonlySet<PropertyType> = new Set(PROPERTY_TYPES);
        yield* failIf(
          !members.has("Roundtrip"),
          `PROPERTY_TYPES must include "Roundtrip"`,
        );
        yield* failIf(
          !members.has("Inclusion"),
          `PROPERTY_TYPES must include "Inclusion"`,
        );
      }),
    ),
);

/**
 * @spec.property property-types-entries-are-unique
 * @spec.type Constant Non-Equality
 * @spec.exports PROPERTY_TYPES
 * @spec.claim PROPERTY_TYPES has no duplicate entries — every kind appears at most once in the closed taxonomy
 */
itSpec.prop(
  "property-types-entries-are-unique",
  { type: "Constant Non-Equality", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        new Set(PROPERTY_TYPES).size !== PROPERTY_TYPES.length,
        `PROPERTY_TYPES has duplicates: ${JSON.stringify(PROPERTY_TYPES)}`,
      ),
    ),
);

/**
 * @spec.property itspec-is-callable-at-the-facade
 * @spec.type Typechecking
 * @spec.exports itSpec
 * @spec.claim the `itSpec` re-exported through the package facade resolves to the same runtime helper that `spec/grammar/it-spec.ts` defines — function shape preserved across the barrel
 */
itSpec.prop(
  "itspec-is-callable-at-the-facade",
  { type: "Typechecking", exports: [itSpec] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        typeof itSpec.todo !== "function" || typeof itSpec.prop !== "function",
        `itSpec must expose callable todo/prop; got todo=${typeof itSpec.todo}, prop=${typeof itSpec.prop}`,
      ),
    ),
);
