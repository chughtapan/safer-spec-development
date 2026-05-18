/**
 * @spec.purpose Edge-case branch coverage for `analysis/properties.ts` —
 *   ts-morph node shapes the happy-path tests in properties.spec.test.ts
 *   don't reach (non-itSpec call expressions, non-literal opts, non-array
 *   opts.exports, property-access exports, concise arrow bodies, non-fn
 *   body args).
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { extractProperties } from "@safer/analysis/properties.js";
import { parseFileDirectives } from "@safer/spec/grammar/index.js";

class PropEdgeAssertionError extends Data.TaggedError("PropEdgeAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, PropEdgeAssertionError> =>
  cond ? Effect.fail(new PropEdgeAssertionError({ detail })) : Effect.void;

const parse = (source: string) =>
  Effect.runSync(parseFileDirectives("test.spec.test.ts", source).pipe(
    Effect.catchAll(() => Effect.succeed([] as never[])),
  ));

const extract = (source: string, declaredExports = new Set<string>()) => {
  const directives = parse(source);
  return extractProperties("test.spec.test.ts", source, directives, declaredExports);
};

const NON_ITSPEC_CALLS_SOURCE = `
import { Effect } from "effect";
console.log("hi");
Effect.die("nope");
const x = (() => 42)();
`;

const NON_LITERAL_ID_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";
const id = "x";

/**
 * @spec.property declared
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim non-literal id
 */
itSpec.todo(id, { type: "Roundtrip", exports: [foo] });
`;

const ABSENT_OPTS_TYPE_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property absent-type
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim opts.type absent
 */
itSpec.todo("absent-type", { exports: [foo] });
`;

const NON_OBJECT_OPTS_SOURCE = `
import { itSpec } from "x";

/**
 * @spec.property non-obj-opts
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim opts is not an object literal
 */
itSpec.todo("non-obj-opts", "notAnObject");
`;

const NON_ARRAY_EXPORTS_SOURCE = `
import { itSpec } from "x";

/**
 * @spec.property non-array
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim opts.exports not an array
 */
itSpec.todo("non-array", { type: "Roundtrip", exports: "notArray" });
`;

const PROPERTY_ACCESS_EXPORT_SOURCE = `
import { itSpec } from "x";
import * as m from "./y";

/**
 * @spec.property prop-access
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim opts.exports uses property access (m.foo)
 */
itSpec.todo("prop-access", { type: "Roundtrip", exports: [m.foo] });
`;

const UNDEFINED_BODY_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property undef-body
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim arrow with concise undefined body
 */
itSpec.prop("undef-body", { type: "Roundtrip", exports: [foo] }, fc.string(), () => undefined);
`;

const NON_FN_BODY_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property non-fn-body
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim body arg is not a function expression
 */
itSpec.prop("non-fn-body", { type: "Roundtrip", exports: [foo] }, fc.string(), "notAFunction");
`;

const NON_BLOCK_BODY_SOURCE = `
import { itSpec } from "x";
import { foo } from "./y";

/**
 * @spec.property non-block-body
 * @spec.type Roundtrip
 * @spec.exports foo
 * @spec.claim arrow body is a concise expression returning a literal (not a block)
 */
itSpec.prop("non-block-body", { type: "Roundtrip", exports: [foo] }, fc.string(), () => true);
`;

/**
 * @spec.property extract-skips-non-itspec-calls
 * @spec.type Constant Equality
 * @spec.exports extractProperties
 * @spec.claim non-itSpec call expressions (console.log, IIFEs, other library calls) are silently skipped — they yield no rows and no issues
 */
itSpec.prop(
  "extract-skips-non-itspec-calls",
  { type: "Constant Equality", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { rows, issues } = extract(NON_ITSPEC_CALLS_SOURCE);
        yield* failIf(rows.length !== 0, `expected 0 rows`);
        yield* failIf(issues.length !== 0, `expected 0 issues; got ${JSON.stringify(issues)}`);
      }),
    ),
);

/**
 * @spec.property extract-non-literal-id-is-mismatch
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim a non-string-literal id (e.g. variable reference) produces a directive-mismatch issue because the validate cross-check cannot read it
 */
itSpec.prop(
  "extract-non-literal-id-is-mismatch",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(NON_LITERAL_ID_SOURCE, new Set(["foo"]));
        yield* failIf(
          !issues.some((i) => i.kind === "directive-mismatch"),
          `expected directive-mismatch for non-literal id`,
        );
      }),
    ),
);

/**
 * @spec.property extract-absent-opts-type-is-mismatch
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim an itSpec call whose opts object omits `type:` produces a directive-mismatch — the JSDoc `@spec.type` cannot ship as truth without runtime corroboration
 */
itSpec.prop(
  "extract-absent-opts-type-is-mismatch",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(ABSENT_OPTS_TYPE_SOURCE, new Set(["foo"]));
        yield* failIf(
          !issues.some((i) => i.kind === "directive-mismatch"),
          `expected directive-mismatch for absent opts.type`,
        );
      }),
    ),
);

/**
 * @spec.property extract-non-object-opts-yields-mismatch
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim an itSpec call where the second argument is not an object literal (string, array, etc.) is treated as opts-absent and produces a directive-mismatch
 */
itSpec.prop(
  "extract-non-object-opts-yields-mismatch",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(NON_OBJECT_OPTS_SOURCE);
        yield* failIf(
          !issues.some((i) => i.kind === "directive-mismatch"),
          `expected directive-mismatch for non-object opts`,
        );
      }),
    ),
);

/**
 * @spec.property extract-non-array-exports-yields-mismatch
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim opts.exports that is not an array literal (string, object) is treated as empty and produces a directive-mismatch
 */
itSpec.prop(
  "extract-non-array-exports-yields-mismatch",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(NON_ARRAY_EXPORTS_SOURCE);
        yield* failIf(
          !issues.some((i) => i.kind === "directive-mismatch"),
          `expected directive-mismatch for non-array exports`,
        );
      }),
    ),
);

/**
 * @spec.property extract-property-access-export-accepted
 * @spec.type Inclusion
 * @spec.exports extractProperties
 * @spec.claim a property-access expression in opts.exports (e.g. `m.foo`) is collected by name (`foo`) — the same as a bare identifier
 */
itSpec.prop(
  "extract-property-access-export-accepted",
  { type: "Inclusion", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(PROPERTY_ACCESS_EXPORT_SOURCE, new Set(["foo"]));
        const hasUnknownExportIssue = issues.some((i) =>
          i.kind === "directive-mismatch" && i.detail.includes("not exported"),
        );
        yield* failIf(hasUnknownExportIssue, `m.foo should be collected as foo and pass the membership check`);
      }),
    ),
);

/**
 * @spec.property extract-concise-arrow-undefined-body-flagged
 * @spec.type Exception Raising
 * @spec.exports extractProperties
 * @spec.claim itSpec.prop with `() => undefined` body counts as an empty-body issue
 */
itSpec.prop(
  "extract-concise-arrow-undefined-body-flagged",
  { type: "Exception Raising", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(UNDEFINED_BODY_SOURCE, new Set(["foo"]));
        yield* failIf(
          !issues.some((i) => i.kind === "empty-body"),
          `expected empty-body issue for () => undefined`,
        );
      }),
    ),
);

/**
 * @spec.property extract-non-function-body-not-flagged
 * @spec.type Constant Equality
 * @spec.exports extractProperties
 * @spec.claim itSpec.prop where the body arg is not a function expression (string literal, etc.) does NOT count as empty-body — only function-typed bodies are inspected for emptiness
 */
itSpec.prop(
  "extract-non-function-body-not-flagged",
  { type: "Constant Equality", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(NON_FN_BODY_SOURCE, new Set(["foo"]));
        yield* failIf(
          issues.some((i) => i.kind === "empty-body"),
          `string body should not be flagged empty (gate inspects fn shapes only)`,
        );
      }),
    ),
);

/**
 * @spec.property extract-concise-true-body-not-flagged
 * @spec.type Constant Equality
 * @spec.exports extractProperties
 * @spec.claim itSpec.prop with `() => true` concise body does NOT count as empty-body — the body has a meaningful expression
 */
itSpec.prop(
  "extract-concise-true-body-not-flagged",
  { type: "Constant Equality", exports: [extractProperties] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { issues } = extract(NON_BLOCK_BODY_SOURCE, new Set(["foo"]));
        yield* failIf(
          issues.some((i) => i.kind === "empty-body"),
          `() => true should not be flagged empty`,
        );
      }),
    ),
);
