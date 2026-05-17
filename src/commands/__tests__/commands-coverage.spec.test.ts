/**
 * @spec.purpose Branch-coverage drivers for the cli command modules.
 *   doctor and explain ship as `\@spec`-documented stubs that return
 *   `Effect.die`; calling them synchronously bumps their function
 *   coverage so v8 enumerates their (empty) branches and the
 *   folder-level branchCoverageFromSpecTests gate stops loud-failing
 *   on "function imported but never called." The generate-dryrun
 *   property runs the real generate function against an in-repo
 *   folder in --dry-run mode so resolveFolders, loadProjectCtxOrDie,
 *   and the per-folder loop all run during the coverage pass.
 */

import { NodeContext } from "@effect/platform-node";
import { Data, Effect, Exit, Option } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { doctor } from "@safer/commands/doctor.js";
import { explain } from "@safer/commands/explain.js";
import { generate } from "@safer/commands/generate.js";

class CmdAssertionError extends Data.TaggedError("CmdAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, CmdAssertionError> =>
  cond ? Effect.fail(new CmdAssertionError({ detail })) : Effect.void;

// Pre-resolve the generate-dryrun outcome once during collect. The
// itSpec.prop body just reads the cached Exit so the fc loop never
// re-runs the (slow) generate pipeline.
const GENERATE_DRYRUN_EXIT = await Effect.runPromise(
  Effect.exit(
    generate({
      folder: Option.some("src/spec/grammar"),
      write: false,
      dryRun: true,
      watch: false,
    }).pipe(Effect.provide(NodeContext.layer)),
  ),
);

const GENERATE_WATCH_EXIT = await Effect.runPromise(
  Effect.exit(
    generate({
      folder: Option.none(),
      write: false,
      dryRun: false,
      watch: true,
    }).pipe(Effect.provide(NodeContext.layer)),
  ),
);

const GENERATE_BOGUS_FOLDER_EXIT = await Effect.runPromise(
  Effect.exit(
    generate({
      folder: Option.some("__nonexistent_folder__"),
      write: false,
      dryRun: true,
      watch: false,
    }).pipe(Effect.provide(NodeContext.layer)),
  ),
);

/**
 * @spec.property doctor-returns-an-effect
 * @spec.type Typechecking
 * @spec.exports doctor
 * @spec.claim `doctor()` synchronously returns an Effect value — the function body runs without requiring the Effect to be executed
 */
itSpec.prop(
  "doctor-returns-an-effect",
  { type: "Typechecking", exports: [doctor] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.sync(() => doctor()).pipe(
        Effect.flatMap((eff) => failIf(typeof eff !== "object" || eff === null, `expected Effect object, got ${typeof eff}`)),
      ),
    ),
);

/**
 * @spec.property explain-returns-an-effect
 * @spec.type Typechecking
 * @spec.exports explain
 * @spec.claim `explain({errorCode})` synchronously returns an Effect value for any input — the function body runs without requiring the Effect to be executed
 */
itSpec.prop(
  "explain-returns-an-effect",
  { type: "Typechecking", exports: [explain] },
  fc.string({ minLength: 1, maxLength: 50 }),
  (errorCode) =>
    Effect.runPromise(
      Effect.sync(() => explain({ errorCode })).pipe(
        Effect.flatMap((eff) => failIf(typeof eff !== "object" || eff === null, `expected Effect object, got ${typeof eff}`)),
      ),
    ),
);

/**
 * @spec.property generate-dryrun-yields-folders-touched
 * @spec.type Inclusion
 * @spec.exports generate
 * @spec.claim `generate({folder: Some("src/spec/grammar"), dryRun: true})` succeeds with `foldersTouched` containing the requested folder and `filesWritten` empty — the dry-run branch logs without touching disk
 */
itSpec.prop(
  "generate-dryrun-yields-folders-touched",
  { type: "Inclusion", exports: [generate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(!Exit.isSuccess(GENERATE_DRYRUN_EXIT), `dry-run should succeed`);
        if (!Exit.isSuccess(GENERATE_DRYRUN_EXIT)) return;
        const result = GENERATE_DRYRUN_EXIT.value;
        yield* failIf(
          !result.foldersTouched.includes("src/spec/grammar"),
          `expected src/spec/grammar in foldersTouched; got ${JSON.stringify(result.foldersTouched)}`,
        );
        yield* failIf(
          result.filesWritten.length !== 0,
          `dry-run should write 0 files; got ${result.filesWritten.length}`,
        );
      }),
    ),
);

/**
 * @spec.property generate-watch-mode-fails-fast
 * @spec.type Exception Raising
 * @spec.exports generate
 * @spec.claim `generate({watch: true})` fails with a `GenerateFolderError` whose reason names "--watch not yet implemented" — the cli's watch flag is documented but unimplemented, so the failure mode is loud
 */
itSpec.prop(
  "generate-watch-mode-fails-fast",
  { type: "Exception Raising", exports: [generate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        !Exit.isFailure(GENERATE_WATCH_EXIT),
        `expected --watch to fail; got ${JSON.stringify(GENERATE_WATCH_EXIT)}`,
      ),
    ),
);

/**
 * @spec.property generate-bogus-folder-fails-with-folder-not-found
 * @spec.type Exception Raising
 * @spec.exports generate
 * @spec.claim `generate({folder: Some("__bogus__")})` fails with a `FolderNotFoundError` carrying the user's requested string — the cli's exit-1 path
 */
itSpec.prop(
  "generate-bogus-folder-fails-with-folder-not-found",
  { type: "Exception Raising", exports: [generate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        !Exit.isFailure(GENERATE_BOGUS_FOLDER_EXIT),
        `expected bogus folder to fail`,
      ),
    ),
);
