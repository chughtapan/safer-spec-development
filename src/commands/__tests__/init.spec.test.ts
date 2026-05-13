/**
 * @spec.purpose Property stubs for the `init` command entrypoint. `init`
 *   scaffolds a folder's first `index.ts` barrel plus one `itSpec.todo`
 *   property stub under `__tests__/&lt;slug>.spec.test.ts`, refuses to
 *   overwrite existing work, and picks a default leaf folder when no
 *   `--folder` is given. The scaffolded output must pass
 *   `generate --write` followed by `validate --planned`.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { init } from "@safer/commands/init.js";

/**
 * @spec.property init-refuses-existing-spec-md
 * @spec.type Exception Raising
 * @spec.exports init
 * @spec.claim init fails with InitError when &lt;folder>/SPEC.md already exists
 */
itSpec.todo("init-refuses-existing-spec-md", {
  type: "Exception Raising",
  exports: [init],
});

/**
 * @spec.property init-scaffolds-index-and-test-stub
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim after init, &lt;folder>/index.ts and &lt;folder>/__tests__/&lt;slug>.spec.test.ts both exist with the expected scaffolding
 */
itSpec.todo("init-scaffolds-index-and-test-stub", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-output-passes-validate-planned
 * @spec.type Constant Equality
 * @spec.exports init
 * @spec.claim running generate --write + validate --planned on the freshly scaffolded folder exits 0
 */
itSpec.todo("init-output-passes-validate-planned", {
  type: "Constant Equality",
  exports: [init],
});

/**
 * @spec.property init-picks-default-folder-when-omitted
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim init without --folder targets a leaf folder under the project root that has an index.ts but no SPEC.md
 */
itSpec.todo("init-picks-default-folder-when-omitted", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-test-stub-imports-existing-barrel-export
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim when the target folder already has an index.ts with at least one named export, the scaffolded test stub imports that export name (not the unused `placeholder` symbol)
 */
itSpec.todo("init-test-stub-imports-existing-barrel-export", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-refuses-existing-barrel-without-named-export
 * @spec.type Exception Raising
 * @spec.exports init
 * @spec.claim when the target folder has an index.ts that declares no named export (only `export default` or empty), init fails with InitError naming the missing-named-export precondition
 */
itSpec.todo("init-refuses-existing-barrel-without-named-export", {
  type: "Exception Raising",
  exports: [init],
});

/**
 * @spec.property init-prefers-leaf-over-ancestor-when-both-lack-spec
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim when both `src/index.ts` and `src/components/index.ts` lack SPEC.md, init without --folder picks the deeper leaf, not the ancestor
 */
itSpec.todo("init-prefers-leaf-over-ancestor-when-both-lack-spec", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-prefers-deeper-leaf-when-root-also-lacks-spec
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim when `./index.ts` (project root) and a descendant both lack SPEC.md, init picks the descendant — the project root never wins the default-leaf selection if any descendant candidate exists
 */
itSpec.todo("init-prefers-deeper-leaf-when-root-also-lacks-spec", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-skips-type-only-exports-when-picking-stub-target
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim when an existing barrel's first export is `type` or `interface` (erased at runtime), the scaffolded stub skips it and binds to the first runtime-value export instead
 */
itSpec.todo("init-skips-type-only-exports-when-picking-stub-target", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-uses-re-export-alias-public-name
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim for an `export { internal as publicName }` re-export the scaffolded stub imports `publicName` (the publicly-bound symbol), not `internal` (the local-only name)
 */
itSpec.todo("init-uses-re-export-alias-public-name", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-skips-const-enum-when-picking-stub-target
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim `export const enum Foo` is treated as a type-only declaration and skipped by the export picker — the scaffolded stub binds to a later runtime-value export, never to the `enum` keyword
 */
itSpec.todo("init-skips-const-enum-when-picking-stub-target", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-skips-default-re-exports-when-picking-stub-target
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim re-export clauses that publicly bind to `default` (`export { default }`, `export { foo as default }`) are skipped — the scaffolded stub never emits `import { default }`
 */
itSpec.todo("init-skips-default-re-exports-when-picking-stub-target", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-uses-namespace-alias-on-star-re-export
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim for `export * as ns from "./x.js"` the scaffolded stub imports `ns` (the runtime module-namespace binding) without recursing into the target file
 */
itSpec.todo("init-uses-namespace-alias-on-star-re-export", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-follows-bare-star-re-export-to-target
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim for `export * from "./x.js"` the picker reads `./x.ts` (or `.tsx`/index variants), finds the first runtime-named export there, and imports it under that name — bounded by STAR_MAX_DEPTH levels of recursion
 */
itSpec.todo("init-follows-bare-star-re-export-to-target", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-strips-comments-and-strings-before-picking-export
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim `// export const fake = 1` and quoted-string text containing `export const fake` do not contribute candidates to the picker — only real declarations are considered
 */
itSpec.todo("init-strips-comments-and-strings-before-picking-export", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-accepts-abstract-class-as-runtime-export
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim `export abstract class Foo` is treated as a runtime named export — the scaffolded stub imports `Foo` rather than the picker refusing the barrel
 */
itSpec.todo("init-accepts-abstract-class-as-runtime-export", {
  type: "Inclusion",
  exports: [init],
});

/**
 * @spec.property init-star-scan-keeps-working-after-string-stripper
 * @spec.type Inclusion
 * @spec.exports init
 * @spec.claim direct/clause scans run on a strings+comments-stripped source while the star-re-export scan runs on the raw source — so a star-only barrel (`export * as ns from "./x"` or `export * from "./x"`) still resolves
 */
itSpec.todo("init-star-scan-keeps-working-after-string-stripper", {
  type: "Inclusion",
  exports: [init],
});
