/**
 * @spec.purpose `generate` command entrypoint. Walks folders (one or all
 *   under cwd), calls `analysis.generateFolder` per folder, and writes
 *   the returned artifacts to disk (or logs them under `--dry-run`).
 *   Per-folder analysis pipeline lives entirely in `@safer/analysis/`;
 *   this file owns the cli boundary (folder discovery, I/O policy,
 *   tagged-error mapping).
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect, Option } from "effect";
import {
  FolderNotFoundError,
  loadProjectContext,
  type ProjectContext,
} from "@safer/project/index.js";
import {
  buildKnownExports,
  generateFolder,
  GenerateFolderError,
  GenerateFolderIOError,
  type GenerateFolderAnyError,
} from "@safer/analysis/index.js";

interface GenerateInput {
  readonly folder: Option.Option<string>;
  readonly write: boolean;
  readonly dryRun: boolean;
  readonly watch: boolean;
}

interface GenerateResult {
  readonly foldersTouched: ReadonlyArray<string>;
  readonly filesWritten: ReadonlyArray<string>;
  readonly diff: string;
}

interface WriteArtifactsArgs {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: string;
  readonly markdown: string;
  readonly sidecarJson: string;
  readonly sidecarRelPath: string;
}

const writeArtifacts = (
  args: WriteArtifactsArgs,
): Effect.Effect<ReadonlyArray<string>, GenerateFolderIOError> =>
  Effect.gen(function* () {
    const { fs, path, folder, markdown, sidecarJson, sidecarRelPath } = args;
    const specPath = path.join(folder, "MODULE.md");
    const sidecarDir = path.dirname(sidecarRelPath);
    yield* fs.makeDirectory(sidecarDir, { recursive: true })
      .pipe(Effect.catchAll(() => Effect.succeed(void 0)));
    const ioErr = (p: string) => (e: unknown): GenerateFolderIOError =>
      new GenerateFolderIOError({
        folder,
        path: p,
        cause: e instanceof Error ? e.message : String(e),
      });
    yield* fs.writeFileString(specPath, markdown).pipe(Effect.mapError(ioErr(specPath)));
    yield* fs.writeFileString(sidecarRelPath, sidecarJson).pipe(Effect.mapError(ioErr(sidecarRelPath)));
    return [specPath, sidecarRelPath];
  });

const resolveFolders = (
  input: GenerateInput,
  ctx: ProjectContext,
): Effect.Effect<ReadonlyArray<string>, GenerateFolderError | FolderNotFoundError> => {
  if (input.watch) {
    return Effect.fail(new GenerateFolderError({
      folder: "<none>", reason: "--watch not yet implemented",
    }));
  }
  if (Option.isSome(input.folder)) {
    return ctx.resolveFolder(input.folder.value).pipe(Effect.map((f) => [f]));
  }
  return Effect.succeed(ctx.folders);
};

const loadProjectCtxOrDie = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<ProjectContext, never> =>
  loadProjectContext(fs, path).pipe(
    Effect.catchTag("ProjectContextError", (e) =>
      Effect.die(new Error(`failed to load project context: ${e.cause}`)),
    ),
    Effect.catchTag("ConfigError", (e) =>
      Effect.die(new Error(`safer-spec.config.json at ${e.path} is invalid: ${e.cause}`)),
    ),
  );

/**
 * @spec.guarantee "emits one MODULE.md + one sidecar JSON per resolved folder; --dry-run logs both without touching disk"
 *   reason: contract for commands/index.ts to translate --write / --dry-run
 *           at the cli boundary.
 */
export const generate = (
  input: GenerateInput,
): Effect.Effect<
  GenerateResult,
  GenerateFolderAnyError | FolderNotFoundError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const ctx = yield* loadProjectCtxOrDie(fs, path);
    const folders = yield* resolveFolders(input, ctx);
    if (folders.length === 0) {
      return yield* Effect.fail(
        new GenerateFolderError({
          folder: "<none>",
          reason: "no folders to generate (no `index.ts` barrel under the project root)",
        }),
      );
    }
    const knownExports = buildKnownExports(ctx);
    const written: string[] = [];
    for (const folder of folders) {
      const { markdown, sidecarJson, sidecarRelPath } =
        yield* generateFolder({ fs, path, folder, projectCtx: ctx, knownExports });
      if (!input.write || input.dryRun) {
        yield* Effect.log(`--- MODULE.md (${folder}) ---\n${markdown}`);
        yield* Effect.log(`--- sidecar (${folder}) ---\n${sidecarJson}`);
      } else {
        const w = yield* writeArtifacts({ fs, path, folder, markdown, sidecarJson, sidecarRelPath });
        written.push(...w);
      }
    }
    return {
      foldersTouched: folders,
      filesWritten: written,
      diff: `wrote ${written.length} files across ${folders.length} folders`,
    };
  }).pipe(Effect.withSpan("commands/generate"));
