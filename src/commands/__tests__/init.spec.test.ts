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
