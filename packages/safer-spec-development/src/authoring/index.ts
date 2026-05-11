/* eslint-disable sonarjs/todo-tag -- this module wraps Vitest's `it.todo`
   collector API by name; "todo" is the public API token, not a stale-task
   marker. The rule treats lowercase "todo" in comments as a TODO tag, but
   here it is the cited Vitest function */
/**
 * @spec.purpose Author-facing test helper. Terminal domain — `itSpec` is
 *   the public surface every spec author imports to declare property
 *   stubs. Wraps Vitest's `it.todo` and `it.prop` so authors get typed
 *   `(id, opts, arb, body)` ergonomics, AND the codemod can read property
 *   metadata back from each call site at codemod time (via #spec/todos.js).
 *
 *   Per parent epic Amendment 6: every `itSpec.prop`/`itSpec.todo` call
 *   carries four required JSDoc directives above it (`@spec.property`,
 *   `@spec.kind`, `@spec.exports`, `@spec.claim`). The codemod's `generate`
 *   mode walks `*.spec.test.ts` files, parses these directives, and emits
 *   the colocated SPEC.md `## Properties` table FROM the tests. The
 *   runtime `meta` argument carries the same metadata for `validate
 *   --implemented` to cross-check JSDoc against runtime opts (mismatch =
 *   exit 11 / MISSING_SPEC_PROPERTY).
 */

import type * as fc from "fast-check";
import { it } from "vitest";
import type { Kind } from "@safer/kinds/index.js";

interface PropertyMeta {
  readonly kind: Kind;
  readonly exports: ReadonlyArray<unknown>;
}

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
   * @spec.assume "JSDoc directives above this call match `id`, `meta.kind`, and `meta.exports` member names"
   *   reason: cross-check enforced by `validate --implemented`.
   * @spec.guarantee "registers a fast-check property under `id` that runs `body` against samples drawn from `arb`"
   *   reason: side-effect contract; runtime registration with Vitest.
   * @spec.residual-contract "fast-check seed and numRuns are inherited from Vitest config; no override here"
   *   reason: behavioral residue beyond the call signature.
   */
  prop<T>(
    id: string,
    meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void;
}

export const itSpec: ItSpec = {
  todo(id: string, _meta: PropertyMeta): void {
    it.todo(id);
  },
  prop<T>(
    id: string,
    _meta: PropertyMeta,
    _arb: fc.Arbitrary<T>,
    _body: (sample: T) => void | Promise<void>,
  ): void {
    // Stage 1 stub: registers as a Vitest placeholder until the implementer
    // (sub-issue #5) wires the fast-check runner. `validate --implemented`
    // reports MISSING_IMPL (13) for any prop with an empty body that has
    // been promoted from the placeholder state.
    it.todo(id);
  },
};
