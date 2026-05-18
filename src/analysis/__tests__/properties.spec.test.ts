/**
 * @spec.purpose Branch coverage for `analysis/properties.ts` — the
 *   `extractProperties` ts-morph walk that turns spec.test.ts source
 *   into `PropertyRow[]` and the `ItSpecIssue[]` validate routes to
 *   gap-class errors. Each property targets one untested branch
 *   (missing directive, JSDoc↔runtime mismatch on property/type/
 *   exports, empty-body detection, declaredExports membership).
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { extractProperties } from "@safer/analysis/properties.js";
import { parseFileDirectives } from "@safer/spec/grammar/index.js";

class PropAssertionError extends Data.TaggedError("PropAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, PropAssertionError> =>
  cond ? Effect.fail(new PropAssertionError({ detail })) : Effect.void;

const parse = (source: string) =>
  Effect.runSync(parseFileDirectives("test.spec.test.ts", source).pipe(
    Effect.catchAll(() => Effect.succeed([] as never[])),
  ));

const extract = (source: string, declaredExports = new Set<string>()) => {
  const directives = parse(source);
  return extractProperties("test.spec.test.ts", source, directives, declaredExports);
};

const HAPPY_SOURCE = `
import { itSpec } from "x";
import * as fc from "fast-check";
import { foo } from "./y";

/**
 * @spec.property foo-roundtrip
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim foo is reversible
 */
itSpec.prop(
  "foo-roundtrip",
  { type: "Roundtrip", exports: [foo] },
  fc.string(),
  (s) => Effect.runPromise(failIf(s !== s, "")),
);
`;

const STUB_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property foo-stub
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim placeholder
 */
itSpec.todo("foo-stub", { type: "Roundtrip", exports: [foo] });
`;

const MISSING_DIRECTIVE_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

itSpec.todo("orphan", { type: "Roundtrip", exports: [foo] });
`;

const MISMATCHED_ID_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property declared-id
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim id mismatch
 */
itSpec.todo("runtime-id", { type: "Roundtrip", exports: [foo] });
`;

const MISMATCHED_TYPE_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property t1
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim type mismatch
 */
itSpec.todo("t1", { type: "Typechecking", exports: [foo] });
`;

const NON_LITERAL_TYPE_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";
const T = "Roundtrip";

/**
 * @spec.property nonlit
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim non-literal type
 */
itSpec.todo("nonlit", { type: T, exports: [foo] });
`;

const EMPTY_RUNTIME_EXPORTS_SOURCE = `
import { itSpec } from "x";

/**
 * @spec.property empty-runtime
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim empty runtime exports
 */
itSpec.todo("empty-runtime", { type: "Roundtrip", exports: [] });
`;

const UNKNOWN_EXPORT_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property unknown-exp
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim foo not in declaredExports
 */
itSpec.todo("unknown-exp", { type: "Roundtrip", exports: [foo] });
`;

const EMPTY_BODY_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property empty-body
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim empty body
 */
itSpec.prop("empty-body", { type: "Roundtrip", exports: [foo] }, fc.string(), () => {});
`;

const EFFECT_DIE_BODY_SOURCE = `
import { itSpec } from "x";
import { Effect } from "effect";
import { foo } from "./y";

/**
 * @spec.property effect-die
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim Effect.die body
 */
itSpec.prop("effect-die", { type: "Roundtrip", exports: [foo] }, fc.string(), () => Effect.die("nope"));
`;

/**
 * @spec.property extract-happy-path-produces-row
 * @spec.type Roundtrip
 * @spec.exports extractProperties
 * @spec.claim a fully-formed itSpec.prop with matching JSDoc directives produces a PropertyRow and no issues
 */
itSpec.prop(
  "extract-happy-path-produces-row",
  { type: "Roundtrip", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { rows, issues } = extract(HAPPY_SOURCE, new Set(["foo"]));
        yield* failIf(rows.length !== 1, `expected 1 row; got ${rows.length}`);
        yield* failIf(issues.length !== 0, `expected 0 issues; got ${JSON.stringify(issues)}`);
        yield* failIf(rows[0]?.id !== "foo-roundtrip", `wrong id`);
        yield* failIf(rows[0]?.stubbed !== false, `should not be stubbed`);
      }),
    ),
);

/**
 * @spec.property extract-stub-row-is-stubbed
 * @spec.type Constant Equality
 * @spec.exports extractProperties
 * @spec.claim an itSpec.todo call produces a row with `stubbed: true`
 */
itSpec.prop(
  "extract-stub-row-is-stubbed",
  { type: "Constant Equality", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { rows, issues } = extract(STUB_SOURCE, new Set(["foo"]));
        yield* failIf(rows.length !== 1, `expected 1 row`);
        yield* failIf(rows[0]?.stubbed !== true, `should be stubbed`);
        yield* failIf(issues.length !== 0, `expected 0 issues`);
      }),
    ),
);

/**
 * @spec.property extract-missing-directive-issue
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim an itSpec call without JSDoc directives raises a missing-directive issue
 */
itSpec.prop(
  "extract-missing-directive-issue",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { rows, issues } = extract(MISSING_DIRECTIVE_SOURCE);
        yield* failIf(rows.length !== 0, `expected 0 rows`);
        yield* failIf(issues.length === 0, `expected at least one issue`);
        yield* failIf(issues[0]?.kind !== "missing-directive", `expected missing-directive`);
      }),
    ),
);

/**
 * @spec.property extract-id-mismatch-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim a JSDoc id ≠ runtime id produces a directive-mismatch issue
 */
itSpec.prop(
  "extract-id-mismatch-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(MISMATCHED_ID_SOURCE, new Set(["foo"]));
        yield* failIf(issues.length === 0, `expected mismatch issue`);
        yield* failIf(issues[0]?.kind !== "directive-mismatch", `expected directive-mismatch`);
      }),
    ),
);

/**
 * @spec.property extract-type-mismatch-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim a JSDoc `@spec.type` ≠ runtime opts.type produces a directive-mismatch issue
 */
itSpec.prop(
  "extract-type-mismatch-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(MISMATCHED_TYPE_SOURCE, new Set(["foo"]));
        yield* failIf(issues.length === 0, `expected mismatch issue`);
        yield* failIf(issues[0]?.kind !== "directive-mismatch", `expected directive-mismatch`);
      }),
    ),
);

/**
 * @spec.property extract-non-literal-type-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim a non-literal opts.type (variable, expression) produces a directive-mismatch — the validate cross-check requires a string literal
 */
itSpec.prop(
  "extract-non-literal-type-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(NON_LITERAL_TYPE_SOURCE, new Set(["foo"]));
        yield* failIf(issues.length === 0, `expected mismatch issue`);
      }),
    ),
);

/**
 * @spec.property extract-empty-runtime-exports-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim opts.exports = [] (empty array) produces a directive-mismatch — masks missing metadata
 */
itSpec.prop(
  "extract-empty-runtime-exports-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(EMPTY_RUNTIME_EXPORTS_SOURCE);
        yield* failIf(issues.length === 0, `expected mismatch issue`);
        yield* failIf(issues[0]?.kind !== "directive-mismatch", `expected directive-mismatch`);
      }),
    ),
);

/**
 * @spec.property extract-unknown-export-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim opts.exports references a symbol not in declaredExports → directive-mismatch
 */
itSpec.prop(
  "extract-unknown-export-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(UNKNOWN_EXPORT_SOURCE, new Set(["bar"]));
        yield* failIf(issues.length === 0, `expected mismatch issue`);
      }),
    ),
);

/**
 * @spec.property extract-empty-body-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim itSpec.prop with `() => {}` body produces an empty-body issue
 */
itSpec.prop(
  "extract-empty-body-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(EMPTY_BODY_SOURCE, new Set(["foo"]));
        yield* failIf(
          !issues.some((i) => i.kind === "empty-body"),
          `expected empty-body issue; got ${JSON.stringify(issues)}`,
        );
      }),
    ),
);

/**
 * @spec.property extract-effect-die-body-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim itSpec.prop with `() => Effect.die(...)` body counts as empty (stub-tier body)
 */
itSpec.prop(
  "extract-effect-die-body-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(EFFECT_DIE_BODY_SOURCE, new Set(["foo"]));
        yield* failIf(
          !issues.some((i) => i.kind === "empty-body"),
          `expected empty-body issue for Effect.die`,
        );
      }),
    ),
);

/**
 * @spec.property extract-empty-declared-exports-skips-membership-check
 * @spec.type Constant Equality
 * @spec.exports extractProperties
 * @spec.claim with empty declaredExports the symbol-membership check is skipped (back-compat for callers that haven't computed the set)
 */
itSpec.prop(
  "extract-empty-declared-exports-skips-membership-check",
  { type: "Constant Equality", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(STUB_SOURCE);
        const hasUnknownExportIssue = issues.some((i) =>
          i.kind === "directive-mismatch" && i.detail.includes("not exported by any file"),
        );
        yield* failIf(hasUnknownExportIssue, `empty declaredExports should skip membership check`);
      }),
    ),
);
