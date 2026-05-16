/**
 * @spec.purpose Author-facing test helper. Terminal domain — `itSpec` is
 *   the public surface every spec author imports to declare property
 *   stubs. Wraps Vitest's `it.todo` and `it.prop` so authors get typed
 *   `(id, opts, arb, body)` ergonomics, AND the codemod can read property
 *   metadata back from each call site at codemod time.
 *
 *   Every `itSpec.prop`/`itSpec.todo` call carries four required JSDoc
 *   directives above it (`@spec.property`, `@spec.type`, `@spec.exports`,
 *   `@spec.claim`). `generate` walks `*.spec.test.ts` files, parses these
 *   directives, and emits the colocated SPEC.md `## Properties` table from
 *   the tests. The runtime `meta` argument carries the same metadata for
 *   `validate --implemented` to cross-check JSDoc against runtime opts.
 *
 *   `prop` additionally attaches the fast-check `RunDetails` (numRuns,
 *   numSkips) to the Vitest task's `meta.fastCheck` slot so the execution
 *   reporter at `spec/reporter.ts` can aggregate per-folder coverage
 *   stats into the per-folder `.safer-spec/&lt;slug&gt;.execution.json`
 *   artifact validate decodes through its co-located Schema.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { it } from "vitest";
import type { PropertyType } from "@safer/spec/grammar/property-types.js";

interface PropertyMeta {
  readonly type: PropertyType;
  readonly exports: ReadonlyArray<unknown>;
}

// Per-test fast-check execution stats. Attached to `task.meta.fastCheck`
// by `itSpec.prop`; the reporter reads this slot, aggregates per folder,
// and writes the execution sidecar. The reporter declares its own local
// copy of this shape so vitest.config.ts can load reporter.ts without
// pulling in `@safer/*` aliases (which aren't resolvable until vite's
// tsconfigPaths plugin is wired).
interface FastCheckTaskStats {
  readonly propertyId: string;
  readonly numRuns: number;
  readonly numSkips: number;
  readonly classifiers: ReadonlyArray<string>;
}

interface TaskMetaSlot {
  fastCheck?: FastCheckTaskStats;
}

class PropertyFailureError extends Data.TaggedError("PropertyFailureError")<{
  readonly id: string;
  readonly message: string;
}> {}

export interface ItSpec {
  /**
   * @spec.assume "first positional `id` arg matches the `@spec.property` JSDoc directive value above the call site"
   *   reason: cross-check enforced by `validate --implemented`; mismatch
   *           is exit code 11 (MISSING_SPEC_PROPERTY).
   * @spec.guarantee "registers the property as a Vitest todo placeholder under `id`"
   *   reason: side-effect contract; the call mutates Vitest's collector,
   *           observable only at runtime.
   * @spec.residual-contract none
   *   reason: shape and refinements captured by parameter types.
   */
  todo(id: string, meta: PropertyMeta): void;

  /**
   * @spec.guarantee "tags the currently-running fast-check sample with a classifier label; labels are aggregated per-property by the reporter and surfaced as `classifierCoverage` in the execution sidecar"
   *   reason: gives authors a way to declare input-distribution buckets
   *           (`"empty"`, `"large"`, `"happy-path"`, ...) so the validate
   *           gate can require tests to actually exercise multiple regions
   *           of the input space, not just pass at one fixed value.
   * @spec.residual-contract "calls outside of an `itSpec.prop` body are silently ignored; classifier capture only takes effect within an active fast-check run"
   *   reason: lifecycle; a no-op outside the property body keeps the API
   *           safe to import at module scope without runtime errors.
   */
  classify(label: string): void;

  /**
   * @spec.assume "JSDoc directives above this call match `id`, `meta.type`, and `meta.exports` member names"
   *   reason: cross-check enforced by `validate --implemented`.
   * @spec.guarantee "registers a fast-check property under `id` that runs `body` against samples drawn from `arb`; on completion attaches `{numRuns, numSkips, classifiers}` to the Vitest task's `meta.fastCheck` slot"
   *   reason: side-effect contract; reporter reads `meta.fastCheck` to
   *           build per-folder execution sidecars.
   * @spec.residual-contract "fast-check seed and numRuns come from fast-check's own defaults (numRuns=100, seed via FC env or random); Vitest config does NOT propagate to fast-check, and this wrapper passes no override"
   *   reason: behavioral residue beyond the call signature; downstream
   *           authors need to know the property runner is not configured
   *           through Vitest.
   */
  prop<T>(
    id: string,
    meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void;
}

// Per-property classifier capture. AsyncLocalStorage scopes the active
// label set to one `fc.check` invocation, so concurrent properties (Vitest
// `sequence.concurrent: true`, etc.) don't race or overwrite each other —
// each property's async chain gets its own Set propagated through awaits.
const classifierContext = new AsyncLocalStorage<Set<string>>();

const recordStats = <Ts>(
  taskMeta: TaskMetaSlot,
  details: fc.RunDetails<Ts>,
  propertyId: string,
  classifiers: ReadonlyArray<string>,
): void => {
  taskMeta.fastCheck = {
    propertyId,
    numRuns: details.numRuns,
    numSkips: details.numSkips,
    classifiers,
  };
};

const failureMessage = <Ts>(details: fc.RunDetails<Ts>): string =>
  details.error ?? `fast-check property failed after ${String(details.numRuns)} runs`;

const runProperty = <T>(
  id: string,
  property: fc.IAsyncProperty<[sample: T]>,
  taskMeta: TaskMetaSlot,
): Effect.Effect<void, PropertyFailureError> =>
  Effect.gen(function* () {
    const labels = new Set<string>();
    const details = yield* Effect.tryPromise({
      try: () => classifierContext.run(labels, () => fc.check(property)),
      catch: (cause) =>
        new PropertyFailureError({
          id,
          message: `fast-check check threw: ${String(cause)}`,
        }),
    });
    recordStats(taskMeta, details, id, [...labels].sort());
    if (details.failed) {
      return yield* Effect.fail(
        new PropertyFailureError({ id, message: failureMessage(details) }),
      );
    }
  });

export const itSpec: ItSpec = {
  todo(id: string, _meta: PropertyMeta): void {
    it.todo(id);
  },
  prop<T>(
    id: string,
    _meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void {
    const property = fc.asyncProperty(arb, (sample) => Promise.resolve(body(sample)));
    // eslint-disable-next-line sonarjs/assertions-in-tests -- fc.check + Effect.fail IS the assertion; sonarjs only recognizes expect/chai/jest patterns
    it(id, (ctx) =>
      Effect.runPromise(runProperty(id, property, ctx.task.meta as TaskMetaSlot)),
    );
  },
  classify(label: string): void {
    const set = classifierContext.getStore();
    if (set !== undefined) set.add(label);
  },
};
