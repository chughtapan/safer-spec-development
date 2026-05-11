/**
 * @spec.purpose
 *   `generate` command entrypoint. Walks one folder under `--folder X`,
 *   parses `@spec*` JSDoc directives on source files (via `spec/directives`),
 *   extracts `itSpec.prop` / `itSpec.todo` call sites + their JSDoc from
 *   `*.spec.test.ts` files (via `spec/todos`), composes a `FolderAnalysis`
 *   (via `spec/source-exports` + `spec/emit`), and emits one `SPEC.md` plus
 *   one `.safer-spec/<folder-slug>.json` sidecar.
 *
 *   First-slice scope: single folder, `--dry-run` vs `--write`, full
 *   directive parsing. Multi-folder walk and `--watch` are deferred.
 *
 *   Tagged errors `GenerateError` and `GenerateIOError` are co-located here.
 */

/* eslint-disable max-classes-per-file -- generate emits two tagged-error
   variants (a user-error variant and an IO-failure variant); co-locating
   with the producer is per-domain ownership. */

import { FileSystem, Path } from "@effect/platform";
import { Brand, Data, Effect, Option } from "effect";
import {
  parseFileDirectives,
  type LocatedDirective,
  type JsDocDirectiveOverflowError,
  type JsDocDirectiveParseError,
  type JsDocUnknownDirectiveError,
} from "@safer/spec/directives/index.js";
import {
  buildSpecArtifact,
  emitMarkdown,
  type FolderAnalysis,
  type PropertyRow,
} from "@safer/spec/emit.js";
import type { SpecArtifact } from "@safer/spec/sidecar.js";
import { serializeSidecar } from "@safer/spec/sidecar-writer.js";
import {
  buildExportEntries,
  collectExports,
  findPurpose,
  type DeclaredExport,
} from "@safer/spec/source-exports.js";
import {
  buildSpecMeta,
  loadProjectContext,
  type ProjectContext,
} from "@safer/commands/validate-pipeline.js";
import { extractProperties } from "@safer/spec/todos.js";

export type FolderPath = string & Brand.Brand<"FolderPath">;
const FolderPath = Brand.nominal<FolderPath>();

export class GenerateError extends Data.TaggedError("GenerateError")<{
  readonly folder: FolderPath;
  readonly reason: string;
}> {}

export class GenerateIOError extends Data.TaggedError("GenerateIOError")<{
  readonly folder: FolderPath;
  readonly path: string;
  readonly cause: string;
}> {}

interface GenerateInput {
  /** `Option.none()` is not yet supported; the first slice requires a folder. */
  readonly folder: Option.Option<string>;
  readonly write: boolean;
  readonly dryRun: boolean;
  readonly watch: boolean;
}

interface GenerateResult {
  readonly foldersTouched: ReadonlyArray<FolderPath>;
  readonly filesWritten: ReadonlyArray<string>;
  readonly diff: string;
}

type DirectiveParseError =
  | JsDocDirectiveOverflowError
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError;

const isTestFile = (name: string): boolean => name.endsWith(".spec.test.ts");
const isSourceFile = (name: string): boolean =>
  name.endsWith(".ts") && !isTestFile(name) && !name.endsWith(".d.ts");

const folderSlug = (folder: FolderPath): string =>
  folder.replace(/^\.\//, "").replace(/\//g, "_");

const isErrorLike = (e: unknown): e is { readonly message: string } => {
  if (typeof e !== "object" || e === null) return false;
  if (!("message" in e)) return false;
  return typeof (e as { message: unknown }).message === "string";
};

const causeOf = (e: unknown): string => (isErrorLike(e) ? e.message : String(e));

const ioToGenerate =
  (folder: FolderPath, path: string) =>
  (e: unknown): GenerateIOError =>
    new GenerateIOError({ folder, path, cause: causeOf(e) });

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs.readDirectory(dir).pipe(
    Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
  );

const collectFolderFiles = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: FolderPath,
  entries: ReadonlyArray<string>,
): Effect.Effect<{ sources: ReadonlyArray<string>; tests: ReadonlyArray<string> }, never> =>
  Effect.gen(function* () {
    const sources: string[] = [];
    const tests: string[] = [];
    for (const name of entries) {
      const full = path.join(folder, name);
      if (isSourceFile(name)) sources.push(full);
      else if (isTestFile(name)) tests.push(full);
    }
    const testsSubdir = path.join(folder, "__tests__");
    const subEntries = yield* readDirSafe(fs, testsSubdir);
    for (const name of subEntries) {
      if (isTestFile(name)) tests.push(path.join(testsSubdir, name));
    }
    return { sources, tests };
  });

const parseSources = (
  fs: FileSystem.FileSystem,
  folder: FolderPath,
  sources: ReadonlyArray<string>,
): Effect.Effect<
  ReadonlyArray<LocatedDirective>,
  GenerateIOError | DirectiveParseError
> =>
  Effect.gen(function* () {
    const allDirectives: LocatedDirective[] = [];
    for (const filePath of sources) {
      const source = yield* fs
        .readFileString(filePath)
        .pipe(Effect.mapError(ioToGenerate(folder, filePath)));
      const fileDirectives = yield* parseFileDirectives(filePath, source);
      allDirectives.push(...fileDirectives);
    }
    return allDirectives;
  });

const collectIndexDeclarations = (
  fs: FileSystem.FileSystem,
  folder: FolderPath,
  indexFilePath: string,
  ctx: ProjectContext,
): Effect.Effect<ReadonlyArray<DeclaredExport>, GenerateIOError> =>
  Effect.gen(function* () {
    const indexFile = ctx.sources.find((s) => s.path === indexFilePath);
    const indexSource =
      indexFile?.source ??
      (yield* fs
        .readFileString(indexFilePath)
        .pipe(Effect.mapError(ioToGenerate(folder, indexFilePath))));
    return collectExports(indexFilePath, indexSource, {
      siblings: ctx.sources,
      paths: ctx.paths,
    });
  });

const parseTests = (
  fs: FileSystem.FileSystem,
  folder: FolderPath,
  tests: ReadonlyArray<string>,
): Effect.Effect<
  ReadonlyArray<PropertyRow>,
  GenerateIOError | DirectiveParseError
> =>
  Effect.gen(function* () {
    const rows: PropertyRow[] = [];
    for (const filePath of tests) {
      const source = yield* fs
        .readFileString(filePath)
        .pipe(Effect.mapError(ioToGenerate(folder, filePath)));
      const testDirectives = yield* parseFileDirectives(filePath, source);
      rows.push(...extractProperties(filePath, source, testDirectives));
    }
    return rows;
  });

interface WriteCtx {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: FolderPath;
  readonly markdown: string;
  readonly sidecarJson: string;
}

const writeOutputs = (
  ctx: WriteCtx,
): Effect.Effect<ReadonlyArray<string>, GenerateIOError> =>
  Effect.gen(function* () {
    const specPath = ctx.path.join(ctx.folder, "SPEC.md");
    const sidecarDir = ctx.path.join(ctx.folder, ".safer-spec");
    const sidecarPath = ctx.path.join(
      sidecarDir,
      `${folderSlug(ctx.folder)}.json`,
    );
    yield* ctx.fs
      .makeDirectory(sidecarDir, { recursive: true })
      .pipe(Effect.catchAll(() => Effect.succeed(void 0)));
    yield* ctx.fs
      .writeFileString(specPath, ctx.markdown)
      .pipe(Effect.mapError(ioToGenerate(ctx.folder, specPath)));
    yield* ctx.fs
      .writeFileString(sidecarPath, ctx.sidecarJson)
      .pipe(Effect.mapError(ioToGenerate(ctx.folder, sidecarPath)));
    return [specPath, sidecarPath];
  });

const checkInputs = (
  input: GenerateInput,
): Effect.Effect<FolderPath, GenerateError> => {
  if (Option.isNone(input.folder)) {
    return Effect.fail(
      new GenerateError({
        folder: FolderPath("<none>"),
        reason: "first slice requires --folder <path>",
      }),
    );
  }
  const folder = FolderPath(input.folder.value);
  if (input.watch) {
    return Effect.fail(
      new GenerateError({ folder, reason: "--watch not yet implemented" }),
    );
  }
  return Effect.succeed(folder);
};

/**
 * @spec.guarantee "two generate calls at the same source state produce byte-identical SPEC.md + sidecar"
 *   reason: roundtrip contract; validate's drift check relies on it.
 * @spec.residual-contract "this slice supports `--folder X` only; whole-tree walk and `--watch` are not yet implemented"
 *   reason: scope-of-this-slice contract.
 */
const buildAnalysis = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: FolderPath,
  ctx: ProjectContext,
): Effect.Effect<
  FolderAnalysis,
  GenerateError | GenerateIOError | DirectiveParseError
> =>
  Effect.gen(function* () {
    const entries = yield* fs
      .readDirectory(folder)
      .pipe(Effect.mapError(ioToGenerate(folder, folder)));
    const { sources, tests } = yield* collectFolderFiles(fs, path, folder, entries);
    const indexFilePath = sources.find(
      (p) => path.basename(p) === "index.ts",
    );
    if (indexFilePath === undefined) {
      return yield* Effect.fail(
        new GenerateError({
          folder,
          reason: "folder has no `index.ts` barrel; folder spec requires one",
        }),
      );
    }
    const directives = yield* parseSources(fs, folder, sources);
    const declarations = yield* collectIndexDeclarations(
      fs,
      folder,
      indexFilePath,
      ctx,
    );
    const properties = yield* parseTests(fs, folder, tests);
    return {
      folder,
      purpose: findPurpose(directives, indexFilePath),
      exports: buildExportEntries(declarations, directives),
      properties,
      sourceFiles: sources,
      testFiles: tests,
    };
  });

const renderSidecar = (
  artifact: SpecArtifact,
  folder: FolderPath,
): Effect.Effect<string, GenerateIOError> =>
  serializeSidecar(artifact).pipe(
    Effect.catchTag("SidecarSchemaError", (e) =>
      Effect.fail(
        new GenerateIOError({ folder, path: e.path, cause: e.issues.join("; ") }),
      ),
    ),
  );


export const generate = (
  input: GenerateInput,
): Effect.Effect<
  GenerateResult,
  GenerateError | GenerateIOError | DirectiveParseError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folder = yield* checkInputs(input);
    const ctx = yield* loadProjectContext(fs, path, ".").pipe(
      Effect.catchTag("ProjectContextError", (e) => Effect.die(new Error(`failed to load project context: ${e.cause}`))),
    );
    const analysis = yield* buildAnalysis(fs, path, folder, ctx);
    const meta = buildSpecMeta(analysis, ctx);
    const markdown = emitMarkdown(analysis, meta);
    const artifact = buildSpecArtifact(analysis, meta);
    const sidecarJson = yield* renderSidecar(artifact, folder);

    if (!input.write || input.dryRun) {
      yield* Effect.log(`--- SPEC.md ---\n${markdown}`);
      yield* Effect.log(`--- sidecar ---\n${sidecarJson}`);
      return { foldersTouched: [folder], filesWritten: [], diff: `${markdown}\n${sidecarJson}` };
    }
    const filesWritten = yield* writeOutputs({ fs, path, folder, markdown, sidecarJson });
    return { foldersTouched: [folder], filesWritten, diff: `wrote ${filesWritten.length} files for ${folder}` };
  }).pipe(Effect.withSpan("commands/generate"));
