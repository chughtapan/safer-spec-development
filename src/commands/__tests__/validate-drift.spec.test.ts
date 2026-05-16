/**
 * @spec.purpose Drift-gate and worktree-resolution properties for `validate`.
 *   Splits out of `validate.spec.test.ts` to keep each file under the
 *   strict line cap; both files cover the `validate` export.
 *
 *   Heavy ts-morph + filesystem work runs once at module load via top-level
 *   await; the fc property body asserts on the cached results.
 */

import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { parseFileDirectives } from "@safer/spec/grammar/directives.js";
import {
  buildExportEntries,
  collectExports,
  type BuildExportEntriesResult,
} from "@safer/analysis/exports.js";
import { validate } from "@safer/commands/validate.js";
import { loadProjectContext } from "@safer/project/context.js";

class DriftAssertionError extends Data.TaggedError("DriftAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, DriftAssertionError> =>
  cond ? Effect.fail(new DriftAssertionError({ detail })) : Effect.void;

const driftSrc =
  `/**\n * @spec.guarantee "claim" reason: documented\n */\nfunction notExported() {}\nexport const real = 1;\n`;
const correctSrc =
  `/**\n * @spec.guarantee "claim" reason: documented\n */\nexport const otherExport = 1;\n`;
const helperSrc =
  `/**\n * @spec.guarantee "claim" reason: documented\n */\nexport const helperFn = 1;\n`;
const externalSrc =
  `/**\n * @spec.guarantee "claim" reason: documented\n */\nexport const externalThing = 1;\n`;

const computeDriftResult = (
  src: string,
  filePath: string,
  knownExports: ReadonlySet<string>,
  localSources: ReadonlySet<string>,
): Effect.Effect<BuildExportEntriesResult, unknown> =>
  Effect.gen(function* () {
    const directives = yield* parseFileDirectives(filePath, src);
    return buildExportEntries(collectExports(filePath, src), directives, {
      folderKnownExports: knownExports,
      localSources,
    });
  });

const DRIFT_RESULT = await Effect.runPromise(
  computeDriftResult(
    driftSrc,
    "file.ts",
    new Set(["real"]),
    new Set(["file.ts"]),
  ),
);
const CORRECT_RESULT = await Effect.runPromise(
  computeDriftResult(
    correctSrc,
    "file.ts",
    new Set(["otherExport"]),
    new Set(["file.ts"]),
  ),
);
const HELPER_RESULT = await Effect.runPromise(
  computeDriftResult(
    helperSrc,
    "helper.ts",
    new Set(["helperFn"]),
    new Set(["helper.ts"]),
  ),
);
// External: directive parsed against external file path with empty localSources.
const EXTERNAL_DIRECTIVES = await Effect.runPromise(
  parseFileDirectives("other-folder/file.ts", externalSrc),
);
const EXTERNAL_RESULT = buildExportEntries([], EXTERNAL_DIRECTIVES, {
  folderKnownExports: new Set<string>(),
  localSources: new Set<string>(),
});

/**
 * @spec.property validate-flags-misplaced-per-export-directive
 * @spec.type Exception Raising
 * @spec.exports validate
 * @spec.claim a per-export directive (`@spec.assume`/`@spec.guarantee`/`@spec.residual-contract`/`@spec.skip`) placed in file-level JSDoc, or naming a symbol the folder doesn't export, fails as MissingSpecPropertyError with exit code 11
 */
itSpec.prop(
  "validate-flags-misplaced-per-export-directive",
  { type: "Exception Raising", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(
          DRIFT_RESULT.unmatched.length === 0,
          `expected drift on misplaced directive`,
        );
        yield* failIf(
          CORRECT_RESULT.unmatched.length !== 0,
          `correctly-placed directive flagged as drift`,
        );
      }),
    ),
);

/**
 * @spec.property validate-drift-gate-uses-folder-wide-export-set
 * @spec.type Constant Equality
 * @spec.exports validate
 * @spec.claim directives that reference internal helpers (exported by a non-barrel source file in the folder) validate successfully; the drift gate's known-exports set is the union of every local source file's exports, not the barrel only
 */
itSpec.prop(
  "validate-drift-gate-uses-folder-wide-export-set",
  { type: "Constant Equality", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        HELPER_RESULT.unmatched.length !== 0,
        `internal-helper directive flagged as drift`,
      ),
    ),
);

/**
 * @spec.property validate-drift-ignores-external-source-directives
 * @spec.type Constant Equality
 * @spec.exports validate
 * @spec.claim a barrel re-exporting a subset of symbols from a sibling-folder source file validates without flagging the source file's other (unrelated) per-export directives as drift; drift checks scope to local sources only
 */
itSpec.prop(
  "validate-drift-ignores-external-source-directives",
  { type: "Constant Equality", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        EXTERNAL_RESULT.unmatched.length !== 0,
        `external-source directive flagged as drift for this folder`,
      ),
    ),
);

// eslint-disable-next-line sonarjs/pseudo-random -- test fixture uniqueness only
const WORKTREE_TMP = `/tmp/safer-spec-worktree-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const WORKTREE_SHA = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

const setupWorktree = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const realGitDir = path.join(WORKTREE_TMP, ".git-dir");
  yield* fs.makeDirectory(realGitDir, { recursive: true });
  yield* fs.writeFileString(path.join(realGitDir, "HEAD"), `${WORKTREE_SHA}\n`);
  yield* fs.writeFileString(path.join(WORKTREE_TMP, ".git"), `gitdir: ${realGitDir}\n`);
  const ctx = yield* loadProjectContext(fs, path, WORKTREE_TMP);
  return ctx.generatedAtSha;
}).pipe(Effect.provide(NodeContext.layer));

const WORKTREE_SHA_OBSERVED = await Effect.runPromise(setupWorktree);

/**
 * @spec.property validate-records-git-worktree-head-sha
 * @spec.type Constant Equality
 * @spec.exports validate
 * @spec.claim when run from a git worktree (`.git` is a file with a `gitdir:` pointer, not a directory), `generatedAtSha` resolves to the actual HEAD SHA via the pointer, not `uncommitted`
 */
itSpec.prop(
  "validate-records-git-worktree-head-sha",
  { type: "Constant Equality", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        WORKTREE_SHA_OBSERVED !== WORKTREE_SHA,
        `expected generatedAtSha=${WORKTREE_SHA}; got ${WORKTREE_SHA_OBSERVED}`,
      ),
    ),
);
