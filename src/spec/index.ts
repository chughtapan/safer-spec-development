/**
 * @spec.purpose Spec domain barrel. Anchors `src/spec/MODULE.md` (codemod
 *   requires every folder with a MODULE.md to expose an `index.ts` barrel) and
 *   re-exports the test-author surface (`itSpec`, `ItSpec`) consumed by the
 *   package facade. The Vitest reporter class is exposed via the dedicated
 *   `@chughtapan/safer-spec-development/reporter` subpath (not this barrel)
 *   so config-time consumers don't transitively load `it-spec.ts`'s
 *   `vitest` import, which throws when evaluated from a config file. The
 *   richer spec-format machinery (directive parser, emitter, sidecar
 *   writer, link resolver) is consumed directly by `commands/` via path
 *   aliases; routing it through this barrel would be ceremony without a
 *   caller.
 */

export { itSpec, type ItSpec } from "@safer/spec/grammar/it-spec.js";
