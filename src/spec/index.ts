/**
 * @spec.purpose Spec domain barrel. Anchors `src/spec/SPEC.md` (codemod
 *   requires every folder with a SPEC to expose an `index.ts` barrel) and
 *   re-exports the test-author surface (`itSpec`, `ItSpec`) plus the
 *   Vitest reporter class (`SaferSpecExecutionReporter`) consumers register
 *   in their own `vitest.config.ts` so `validate --implemented` can find
 *   the per-folder execution sidecar. The richer spec-format machinery
 *   (directive parser, emitter, sidecar writer, link resolver) is consumed
 *   directly by `commands/` via path aliases; routing it through this
 *   barrel would be ceremony without a caller.
 */

export { itSpec, type ItSpec } from "@safer/spec/it-spec.js";
export { SaferSpecExecutionReporter } from "@safer/spec/reporter.js";
