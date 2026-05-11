/**
 * @spec.purpose Author-facing helper. Wraps Vitest's pending-test and
 *   property-test runners so authors don't have to remember the `meta`
 *   nesting Vitest's runner requires.
 *
 * @spec.guarantee The first positional string is the canonical property id;
 *   never duplicated in the metadata object.
 *   reason: prevents id-drift between the string and the object across edits.
 *
 * Stage 0 interface stubs; Stage 1 implements.
 */

import { Data, Effect } from "effect";
import type { PropertyMeta } from "./types.js";

class NotImplementedError extends Data.TaggedError("NotImplementedError")<{
  readonly site: string;
}> {}

const notImplemented = (site: string): never =>
  Effect.runSync(Effect.die(new NotImplementedError({ site })));

export interface ItSpec {
  todo(id: string, meta: PropertyMeta): void;
  prop<T extends readonly unknown[]>(
    id: string,
    meta: PropertyMeta,
    ...rest: unknown[]
  ): void;
}

export const itSpec: ItSpec = {
  todo(_id: string, _meta: PropertyMeta): void {
    notImplemented("itSpec.todo");
  },
  prop(_id: string, _meta: PropertyMeta, ..._rest: unknown[]): void {
    notImplemented("itSpec.prop");
  },
};
