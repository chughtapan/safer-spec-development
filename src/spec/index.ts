/**
 * @spec.purpose Spec domain barrel. Anchors `src/spec/SPEC.md` (codemod
 *   requires every folder with a SPEC to expose an `index.ts` barrel) and
 *   re-exports the test-author surface (`itSpec`, `ItSpec`) consumed by the
 *   package facade. The richer spec-format machinery (directive parser,
 *   emitter, sidecar writer, link resolver) is consumed directly by
 *   `commands/` via path aliases; routing it through this barrel would be
 *   ceremony without a caller.
 */

export { itSpec, type ItSpec } from "@safer/spec/it-spec.js";
