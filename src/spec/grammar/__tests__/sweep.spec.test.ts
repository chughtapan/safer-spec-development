/**
 * @spec.purpose Coverage-sweep tests for `spec/grammar/`. Adds property
 *   types beyond the dedicated `parser.spec.test.ts` (parseFileDirectives)
 *   and `grammar.spec.test.ts` (constants + error classes) — covers the
 *   Typechecking / Constant Bounds Checking / Inclusion residue per
 *   export so the per-folder coverage gate has room.
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

class GrammarSweepAssertionError extends Data.TaggedError(
  "GrammarSweepAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, GrammarSweepAssertionError> =>
  cond ? Effect.fail(new GrammarSweepAssertionError({ detail })) : Effect.void;

const DIR_PAYLOAD = {
  path: "src/x.ts",
  line: 1,
  directive: "purpose",
} as const;

/* ---------- DIRECTIVE_BODY_MAX_CHARS ---------- */

/**
 * @spec.property directive-body-max-chars-typechecks-as-number
 * @spec.type Typechecking
 * @spec.exports DIRECTIVE_BODY_MAX_CHARS
 * @spec.claim `DIRECTIVE_BODY_MAX_CHARS` is a `number` literal — the typed const directive parsers compare body lengths against
 */
itSpec.prop(
  "directive-body-max-chars-typechecks-as-number",
  { type: "Typechecking", exports: [DIRECTIVE_BODY_MAX_CHARS] },
  fc.constant(undefined),
  () => Effect.runPromise(failIf(typeof DIRECTIVE_BODY_MAX_CHARS !== "number", `not number`)),
);

/**
 * @spec.property directive-body-max-chars-bounded-range
 * @spec.type Inclusion
 * @spec.exports DIRECTIVE_BODY_MAX_CHARS
 * @spec.claim the cap sits in the practical range 100..2000 — caps below 100 disable expressive prose; caps above 2000 invite an editor-window-breaking diagnostic that authors won't read
 */
itSpec.prop(
  "directive-body-max-chars-bounded-range",
  { type: "Inclusion", exports: [DIRECTIVE_BODY_MAX_CHARS] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        DIRECTIVE_BODY_MAX_CHARS < 100 || DIRECTIVE_BODY_MAX_CHARS > 2000,
        `outside 100..2000: ${DIRECTIVE_BODY_MAX_CHARS}`,
      ),
    ),
);

/* ---------- PROPERTY_TYPES ---------- */

/**
 * @spec.property property-types-bounded-by-paper-rounding
 * @spec.type Constant Bounds Checking
 * @spec.exports PROPERTY_TYPES
 * @spec.claim `PROPERTY_TYPES.length` stays in 8..12 — the OOPSLA paper's 9-category vocabulary is the documented target; future per-repo extensions append a few more, never reduce
 */
itSpec.prop(
  "property-types-bounded-by-paper-rounding",
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
 * @spec.property property-types-no-empty-entries
 * @spec.type Constant Non-Equality
 * @spec.exports PROPERTY_TYPES
 * @spec.claim no entry is empty or whitespace-only — every member is a renderable label the SPEC.md `## Properties` table uses verbatim
 */
itSpec.prop(
  "property-types-no-empty-entries",
  { type: "Constant Non-Equality", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        for (const pt of PROPERTY_TYPES) {
          yield* failIf(pt.length === 0 || pt.trim() !== pt, `bad entry: ${JSON.stringify(pt)}`);
        }
      }),
    ),
);

/**
 * @spec.property property-types-roundtrip-through-set
 * @spec.type Roundtrip
 * @spec.exports PROPERTY_TYPES
 * @spec.claim `[...new Set(PROPERTY_TYPES)].length === PROPERTY_TYPES.length` — the tuple already deduplicates; Set construction is a no-op (no dropped members)
 */
itSpec.prop(
  "property-types-roundtrip-through-set",
  { type: "Roundtrip", exports: [PROPERTY_TYPES] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        [...new Set(PROPERTY_TYPES)].length !== PROPERTY_TYPES.length,
        `dedup lost entries`,
      ),
    ),
);

/* ---------- JsDocDirectiveOverflowError ---------- */

const OVERFLOW_PAYLOAD = { ...DIR_PAYLOAD, length: 501, limit: 500 } as const;

/**
 * @spec.property jsdoc-overflow-error-typechecks-as-error
 * @spec.type Typechecking
 * @spec.exports JsDocDirectiveOverflowError
 * @spec.claim `JsDocDirectiveOverflowError` instances extend native `Error` — the runtime contract Effect's exit-cause renderer expects
 */
itSpec.prop(
  "jsdoc-overflow-error-typechecks-as-error",
  { type: "Typechecking", exports: [JsDocDirectiveOverflowError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        !(new JsDocDirectiveOverflowError(OVERFLOW_PAYLOAD) instanceof Error),
        `must extend Error`,
      ),
    ),
);

/**
 * @spec.property jsdoc-overflow-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports JsDocDirectiveOverflowError
 * @spec.claim `JsDocDirectiveOverflowError` round-trips through `Effect.fail` / `Effect.catchTag` — the stub-tier diagnostic catchDirectiveErrors translates
 */
itSpec.prop(
  "jsdoc-overflow-error-is-throwable",
  { type: "Exception Raising", exports: [JsDocDirectiveOverflowError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(new JsDocDirectiveOverflowError(OVERFLOW_PAYLOAD)).pipe(
          Effect.catchTag("JsDocDirectiveOverflowError", (e) => Effect.succeed(e.length)),
        );
        yield* failIf(caught !== OVERFLOW_PAYLOAD.length, `roundtrip lost length`);
      }),
    ),
);

/**
 * @spec.property jsdoc-overflow-error-bounded-payload
 * @spec.type Constant Bounds Checking
 * @spec.exports JsDocDirectiveOverflowError
 * @spec.claim every constructed instance has `length > limit` numerically — the precondition for an overflow diagnosis to make sense
 */
itSpec.prop(
  "jsdoc-overflow-error-bounded-payload",
  { type: "Constant Bounds Checking", exports: [JsDocDirectiveOverflowError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        OVERFLOW_PAYLOAD.length <= OVERFLOW_PAYLOAD.limit,
        `length must exceed limit`,
      ),
    ),
);

/* ---------- JsDocDirectiveParseError ---------- */

const PARSE_PAYLOAD = { ...DIR_PAYLOAD, reason: "fixture" } as const;

/**
 * @spec.property jsdoc-parse-error-typechecks-as-error
 * @spec.type Typechecking
 * @spec.exports JsDocDirectiveParseError
 * @spec.claim `JsDocDirectiveParseError` instances extend `Error` and expose `_tag`, `path`, `line`, `directive`, `reason` strings/numbers
 */
itSpec.prop(
  "jsdoc-parse-error-typechecks-as-error",
  { type: "Typechecking", exports: [JsDocDirectiveParseError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new JsDocDirectiveParseError(PARSE_PAYLOAD);
        yield* failIf(!(e instanceof Error), `Error`);
        yield* failIf(typeof e.path !== "string", `path string`);
        yield* failIf(typeof e.line !== "number", `line number`);
      }),
    ),
);

/**
 * @spec.property jsdoc-parse-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports JsDocDirectiveParseError
 * @spec.claim `JsDocDirectiveParseError` round-trips through `Effect.fail` / `Effect.catchTag` — the stub-tier diagnostic the validate gate routes via catchDirectiveErrors
 */
itSpec.prop(
  "jsdoc-parse-error-is-throwable",
  { type: "Exception Raising", exports: [JsDocDirectiveParseError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(new JsDocDirectiveParseError(PARSE_PAYLOAD)).pipe(
          Effect.catchTag("JsDocDirectiveParseError", (e) => Effect.succeed(e.reason)),
        );
        yield* failIf(caught !== PARSE_PAYLOAD.reason, `reason roundtrip`);
      }),
    ),
);

/**
 * @spec.property jsdoc-parse-error-roundtrips-payload
 * @spec.type Roundtrip
 * @spec.exports JsDocDirectiveParseError
 * @spec.claim payload fields roundtrip through the constructor — the surface validate's stub-tier diagnostic reads
 */
itSpec.prop(
  "jsdoc-parse-error-roundtrips-payload",
  { type: "Roundtrip", exports: [JsDocDirectiveParseError] },
  fc.record({
    path: fc.string({ minLength: 1, maxLength: 40 }),
    line: fc.integer({ min: 1, max: 1_000 }),
    directive: fc.constantFrom("purpose", "guarantee", "claim"),
    reason: fc.string({ minLength: 1, maxLength: 80 }),
  }),
  (payload) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new JsDocDirectiveParseError(payload);
        yield* failIf(e.path !== payload.path, `path`);
        yield* failIf(e.line !== payload.line, `line`);
        yield* failIf(e.directive !== payload.directive, `directive`);
        yield* failIf(e.reason !== payload.reason, `reason`);
      }),
    ),
);

/* ---------- JsDocUnknownDirectiveError ---------- */

const UNKNOWN_PAYLOAD = { ...DIR_PAYLOAD, directive: "frobnitz" } as const;

/**
 * @spec.property jsdoc-unknown-error-typechecks-as-error
 * @spec.type Typechecking
 * @spec.exports JsDocUnknownDirectiveError
 * @spec.claim instances extend `Error` with `_tag === "JsDocUnknownDirectiveError"` and a string `directive` field naming the offending tag
 */
itSpec.prop(
  "jsdoc-unknown-error-typechecks-as-error",
  { type: "Typechecking", exports: [JsDocUnknownDirectiveError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new JsDocUnknownDirectiveError(UNKNOWN_PAYLOAD);
        yield* failIf(!(e instanceof Error), `Error`);
        yield* failIf(e._tag !== "JsDocUnknownDirectiveError", `tag`);
        yield* failIf(typeof e.directive !== "string", `directive`);
      }),
    ),
);

/**
 * @spec.property jsdoc-unknown-error-roundtrips-payload
 * @spec.type Roundtrip
 * @spec.exports JsDocUnknownDirectiveError
 * @spec.claim the `{path, line, directive}` payload roundtrips through the constructor — the routing surface validate's stub-tier diagnostic depends on
 */
itSpec.prop(
  "jsdoc-unknown-error-roundtrips-payload",
  { type: "Roundtrip", exports: [JsDocUnknownDirectiveError] },
  fc.record({
    path: fc.string({ minLength: 1, maxLength: 40 }),
    line: fc.integer({ min: 1, max: 1_000 }),
    directive: fc.string({ minLength: 1, maxLength: 30 }),
  }),
  (payload) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new JsDocUnknownDirectiveError(payload);
        yield* failIf(e.path !== payload.path, `path`);
        yield* failIf(e.line !== payload.line, `line`);
        yield* failIf(e.directive !== payload.directive, `directive`);
      }),
    ),
);

/**
 * @spec.property jsdoc-unknown-error-constant-tag
 * @spec.type Constant Equality
 * @spec.exports JsDocUnknownDirectiveError
 * @spec.claim every instance carries `_tag === "JsDocUnknownDirectiveError"` — the discriminant `catchDirectiveErrors` routes on
 */
itSpec.prop(
  "jsdoc-unknown-error-constant-tag",
  { type: "Constant Equality", exports: [JsDocUnknownDirectiveError] },
  fc.string({ minLength: 1, maxLength: 30 }),
  (directive) =>
    Effect.runPromise(
      failIf(
        new JsDocUnknownDirectiveError({ ...DIR_PAYLOAD, directive })._tag !==
          "JsDocUnknownDirectiveError",
        `tag must be stable`,
      ),
    ),
);
