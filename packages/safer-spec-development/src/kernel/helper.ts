/* eslint-disable sonarjs/todo-tag -- this module wraps Vitest's `it.todo`
   collector API by name; "todo" is the public API token, not a stale-task
   marker. The rule treats lowercase "todo" in comments as a TODO tag, but
   here it is the cited Vitest function */
/**
 * @spec.purpose Author-facing helper. Wraps Vitest's `it.todo` so authors get
 *   typed `(id, { kind, exports })` ergonomics without remembering Vitest's
 *   collector-options shape.
 *
 * @spec.guarantee Property metadata is parsed from the source via ts-morph
 *   (kind-detector) at codemod time; the runtime call only registers the
 *   placeholder test under the canonical property id.
 *   reason: Vitest's `TestCollectorOptions` does not surface `meta` in its
 *           public types; relying on task.meta at runtime would couple the
 *           helper to a non-public Vitest API. Parsing the source is the
 *           refactor-safe equivalent.
 */

import { it } from "vitest";
import type { Kind } from "./kinds.js";

interface PropertyMeta {
  kind: Kind;
  exports: ReadonlyArray<unknown>;
}

export interface ItSpec {
  todo(id: string, meta: PropertyMeta): void;
  prop(id: string, meta: PropertyMeta, ...rest: ReadonlyArray<unknown>): void;
}

export const itSpec: ItSpec = {
  todo(id: string, _meta: PropertyMeta): void {
    it.todo(id);
  },
  prop(id: string, _meta: PropertyMeta, ..._rest: ReadonlyArray<unknown>): void {
    // Stage 1 stub: declares the property as a placeholder until the
    // implementer (sub-issue #5) fills the fast-check body. `validate
    // --implemented` reports MISSING_IMPL (13) for any prop with an empty
    // body that has been promoted from the placeholder state (Stage 5 spec
    // sub-issue #3, Invariant 7a).
    it.todo(id);
  },
};
