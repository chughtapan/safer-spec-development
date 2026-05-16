/**
 * @spec.purpose Property tests for `spec/grammar/`'s exports beyond the
 *   directive parser. `parser.spec.test.ts` covers `parseFileDirectives`
 *   end-to-end; this file covers the supporting surface — the
 *   `DIRECTIVE_BODY_MAX_CHARS` constant, the closed `PROPERTY_TYPES`
 *   vocabulary, and the three JsDoc directive tagged-error classes.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  DIRECTIVE_BODY_MAX_CHARS,
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
  JsDocUnknownDirectiveError,
} from "@safer/spec/grammar/directives.js";
import { PROPERTY_TYPES } from "@safer/spec/grammar/property-types.js";

class GrammarAssertionError extends Data.TaggedError("GrammarAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, GrammarAssertionError> =>
  cond ? Effect.fail(new GrammarAssertionError({ detail })) : Effect.void;

/**
 * @spec.property directive-body-max-chars-is-500
 * @spec.type Constant Equality
 * @spec.exports DIRECTIVE_BODY_MAX_CHARS
 * @spec.claim the directive body length cap is exactly 500 — the contract every `@spec.*` directive's body length is checked against; downstream agents that wrote large prose blocks would silently truncate without this
 */
itSpec.prop(
  "directive-body-max-chars-is-500",
  { type: "Constant Equality", exports: [DIRECTIVE_BODY_MAX_CHARS] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        DIRECTIVE_BODY_MAX_CHARS !== 500,
        `expected 500, got ${DIRECTIVE_BODY_MAX_CHARS}`,
      ),
    ),
);

/**
 * @spec.property directive-body-max-chars-positive-int
 * @spec.type Constant Bounds Checking
 * @spec.exports DIRECTIVE_BODY_MAX_CHARS
 * @spec.claim the cap is a positive integer — the body-length check against `body.length > cap` would short-circuit incorrectly with a zero or negative cap
 */
itSpec.prop(
  "directive-body-max-chars-positive-int",
  { type: "Constant Bounds Checking", exports: [DIRECTIVE_BODY_MAX_CHARS] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        !Number.isInteger(DIRECTIVE_BODY_MAX_CHARS) || DIRECTIVE_BODY_MAX_CHARS <= 0,
        `cap must be a positive integer; got ${DIRECTIVE_BODY_MAX_CHARS}`,
      ),
    ),
);

/**
 * @spec.property property-types-tuple-has-typechecking-kind
 * @spec.type Typechecking
 * @spec.exports PROPERTY_TYPES
 * @spec.claim `PROPERTY_TYPES` is a readonly array of non-empty strings — the type-coverage divisor + the `@spec.type` vocabulary literal-union derives from this tuple
 */
itSpec.prop(
  "property-types-tuple-has-typechecking-kind",
  { type: "Typechecking", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(
          !Array.isArray(PROPERTY_TYPES),
          `PROPERTY_TYPES must be an array`,
        );
        for (const pt of PROPERTY_TYPES) {
          yield* failIf(
            typeof pt !== "string" || pt.length === 0,
            `every entry must be a non-empty string; got ${JSON.stringify(pt)}`,
          );
        }
      }),
    ),
);

const overflowArb = fc.record({
  path: fc.string({ minLength: 1, maxLength: 60 }),
  line: fc.integer({ min: 1, max: 10_000 }),
  directive: fc.constantFrom("purpose", "guarantee", "claim", "assume"),
  length: fc.integer({ min: 501, max: 5_000 }),
  limit: fc.constant(500),
});

/**
 * @spec.property jsdoc-overflow-error-roundtrips-payload
 * @spec.type Constant Equality
 * @spec.exports JsDocDirectiveOverflowError
 * @spec.claim a `JsDocDirectiveOverflowError` exposes the `{path, line, directive, length, limit}` payload it was constructed with — the body the validate diagnostic reads to point the user at the call site
 */
itSpec.prop(
  "jsdoc-overflow-error-roundtrips-payload",
  { type: "Constant Equality", exports: [JsDocDirectiveOverflowError] },
  overflowArb,
  (payload) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new JsDocDirectiveOverflowError(payload);
        yield* failIf(e.path !== payload.path, `path roundtrip`);
        yield* failIf(e.line !== payload.line, `line roundtrip`);
        yield* failIf(e.directive !== payload.directive, `directive roundtrip`);
        yield* failIf(e.length !== payload.length, `length roundtrip`);
        yield* failIf(e.limit !== payload.limit, `limit roundtrip`);
        yield* failIf(e._tag !== "JsDocDirectiveOverflowError", `tag`);
      }),
    ),
);

const parseErrorArb = fc.record({
  path: fc.string({ minLength: 1, maxLength: 60 }),
  line: fc.integer({ min: 1, max: 10_000 }),
  directive: fc.constantFrom("purpose", "guarantee", "claim", "assume"),
  reason: fc.string({ minLength: 1, maxLength: 100 }),
});

/**
 * @spec.property jsdoc-parse-error-tag-stable
 * @spec.type Constant Equality
 * @spec.exports JsDocDirectiveParseError
 * @spec.claim every `JsDocDirectiveParseError` instance carries `_tag === "JsDocDirectiveParseError"` — the discriminant validate-checks routes on
 */
itSpec.prop(
  "jsdoc-parse-error-tag-stable",
  { type: "Constant Equality", exports: [JsDocDirectiveParseError] },
  parseErrorArb,
  (payload) =>
    Effect.runPromise(
      failIf(
        new JsDocDirectiveParseError(payload)._tag !== "JsDocDirectiveParseError",
        `tag stable check`,
      ),
    ),
);

const unknownErrorArb = fc.record({
  path: fc.string({ minLength: 1, maxLength: 60 }),
  line: fc.integer({ min: 1, max: 10_000 }),
  directive: fc.string({ minLength: 1, maxLength: 40 }),
});

/**
 * @spec.property jsdoc-unknown-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports JsDocUnknownDirectiveError
 * @spec.claim `JsDocUnknownDirectiveError` round-trips through `Effect.fail` / `Effect.catchTag` without payload loss — the surface validate uses to translate `@spec.foo` (unknown tags) into stub-tier exits
 */
itSpec.prop(
  "jsdoc-unknown-error-is-throwable",
  { type: "Exception Raising", exports: [JsDocUnknownDirectiveError] },
  unknownErrorArb,
  (payload) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(new JsDocUnknownDirectiveError(payload)).pipe(
          Effect.catchTag("JsDocUnknownDirectiveError", (x) => Effect.succeed(x.directive)),
        );
        yield* failIf(caught !== payload.directive, `catchTag roundtrip failed`);
      }),
    ),
);
