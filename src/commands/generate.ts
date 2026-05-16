/**
 * @spec.purpose `generate` command entrypoint. Walks one folder under
 *   `--folder X`, parses `@spec*` JSDoc directives, extracts `itSpec.*`
 *   call sites + JSDoc from `*.spec.test.ts`, composes a `FolderAnalysis`,
 *   and emits one `SPEC.md` plus one `.safer-spec/&lt;slug>.json` sidecar.
 *   Tagged errors `GenerateError` and `GenerateIOError` are co-located.
 */
 

import { FileSystem, Path } from "@effect/platform";
import { Brand, Data, Effect, Option } from "effect";
import {
  buildChildren,
  discoverFolders,
  discoverImmediateSubfolders,
  loadProjectContext,
  normalizeFolder,
  type ProjectContext,
} from "@safer/project/index.js";
import {
  parseFileDirectives,
  type LocatedDirective,
  type JsDocDirectiveOverflowError,
  type JsDocDirectiveParseError,
  type JsDocUnknownDirectiveError,
} from "@safer/spec/grammar/index.js";
import {
  buildSpecArtifact,
  emitMarkdown,
  serializeSidecar,
  sidecarSlug,
  type FolderAnalysis,
  type PropertyRow,
  type SpecArtifact,
} from "@safer/spec/artifact/index.js";
import {
  buildExportEntries,
  buildSpecMeta,
  collectExports,
  extractProperties,
  indexFilePurposes,
  uniqueExternalSources,
  type DeclaredExport,
} from "@safer/analysis/index.js";

type FolderPath = string & Brand.Brand<"FolderPath">;
const FolderPath = Brand.nominal<FolderPath>();

class GenerateError extends Data.TaggedError("GenerateError")<{
  readonly folder: FolderPath;
  readonly reason: string;
}> {}

class GenerateIOError extends Data.TaggedError("GenerateIOError")<{
  readonly folder: FolderPath;
  readonly path: string;
  readonly cause: string;
}> {}

interface GenerateInput {
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
type GenerateAnyError = GenerateError | GenerateIOError | DirectiveParseError;

const isTestFile = (n: string): boolean => n.endsWith(".spec.test.ts");
const isSourceFile = (n: string): boolean =>
  n.endsWith(".ts") && !isTestFile(n) && !n.endsWith(".d.ts");

const causeOf = (e: unknown): string => {
  if (typeof e !== "object" || e === null || !("message" in e)) return String(e);
  const m = (e as { message: unknown }).message;
  return typeof m === "string" ? m : String(e);
};
const ioToGenerate = (folder: FolderPath, path: string) =>
  (e: unknown): GenerateIOError =>
    new GenerateIOError({ folder, path, cause: causeOf(e) });

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs.readDirectory(dir).pipe(
    Effect.map((es) => [...es].sort()),
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
    const subEntries = yield* readDirSafe(fs, path.join(folder, "__tests__"));
    for (const name of subEntries) {
      if (isTestFile(name)) tests.push(path.join(folder, "__tests__", name));
    }
    return { sources, tests };
  });

const exportsOfFile = (
  fs: FileSystem.FileSystem,
  folder: FolderPath,
  filePath: string,
  ctx: ProjectContext,
): Effect.Effect<ReadonlyArray<DeclaredExport>, GenerateIOError> =>
  Effect.gen(function* () {
    const cached = ctx.sources.find((s) => s.path === filePath);
    const src = cached?.source ??
      (yield* fs.readFileString(filePath).pipe(Effect.mapError(ioToGenerate(folder, filePath))));
    return collectExports(filePath, src, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    });
  });

interface TestParse {
  readonly rows: ReadonlyArray<PropertyRow>;
  readonly directives: ReadonlyArray<LocatedDirective>;
}

const parseTests = (
  fs: FileSystem.FileSystem,
  folder: FolderPath,
  tests: ReadonlyArray<string>,
  declaredExports: ReadonlySet<string>,
): Effect.Effect<TestParse, GenerateIOError | DirectiveParseError> =>
  Effect.gen(function* () {
    const rows: PropertyRow[] = [];
    const directives: LocatedDirective[] = [];
    for (const filePath of tests) {
      const source = yield* fs
        .readFileString(filePath)
        .pipe(Effect.mapError(ioToGenerate(folder, filePath)));
      const dirs = yield* parseFileDirectives(filePath, source);
      directives.push(...dirs);
      rows.push(...extractProperties(filePath, source, dirs, declaredExports).rows);
    }
    return { rows, directives };
  });

// Project-wide symbol existence set; loosens `extractProperties` typo gate
// to accept cross-folder symbol references while rejecting non-existent
// names. See round-14 fix commit for rationale.
const collectKnownExports = (ctx: ProjectContext): ReadonlySet<string> => {
  const out = new Set<string>();
  for (const sf of ctx.sources) {
    for (const d of collectExports(sf.path, sf.source, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    })) {
      out.add(d.name);
      out.add(d.declaredName);
    }
  }
  return out;
};

interface BuildCtx {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly ctx: ProjectContext;
  readonly knownExports: ReadonlySet<string>;
}

const buildAnalysis = (
  bx: BuildCtx,
  folder: FolderPath,
): Effect.Effect<FolderAnalysis, GenerateAnyError> =>
  Effect.gen(function* () {
    const entries = yield* bx.fs.readDirectory(folder).pipe(
      Effect.map((es) => [...es].sort()),
      Effect.mapError(ioToGenerate(folder, folder)),
    );
    const { sources, tests } = yield* collectFolderFiles(bx.fs, bx.path, folder, entries);
    const indexFilePath = sources.find((p) => bx.path.basename(p) === "index.ts");
    if (indexFilePath === undefined) {
      return yield* Effect.fail(new GenerateError({
        folder, reason: "folder has no `index.ts` barrel; folder spec requires one",
      }));
    }
    const declarations = yield* exportsOfFile(bx.fs, folder, indexFilePath, bx.ctx);
    const directives: LocatedDirective[] = [];
    for (const filePath of [...sources, ...uniqueExternalSources(declarations, sources)]) {
      const source = yield* bx.fs.readFileString(filePath)
        .pipe(Effect.mapError(ioToGenerate(folder, filePath)));
      directives.push(...(yield* parseFileDirectives(filePath, source)));
    }
    const { rows: properties, directives: testDirectives } =
      yield* parseTests(bx.fs, folder, tests, bx.knownExports);
    const subfolders = yield* discoverImmediateSubfolders(bx.fs, bx.path, folder);
    const subDirectives: LocatedDirective[] = [];
    for (const sub of subfolders) {
      const idx = bx.path.join(sub, "index.ts");
      const src = yield* bx.fs.readFileString(idx)
        .pipe(Effect.mapError(ioToGenerate(folder, idx)));
      subDirectives.push(...(yield* parseFileDirectives(idx, src)));
    }
    const purposeByPath = indexFilePurposes([
      ...directives, ...testDirectives, ...subDirectives,
    ]);
    const children = buildChildren({
      folder, sources, tests, subfolders, purposeByPath, path: bx.path,
    });
    return {
      folder,
      purpose: purposeByPath.get(indexFilePath) ?? null,
      exports: buildExportEntries(declarations, directives).entries,
      properties,
      children,
    };
  });


interface WriteCtx {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: FolderPath;
  readonly markdown: string;
  readonly sidecarJson: string;
}

const writeOutputs = (
  c: WriteCtx,
): Effect.Effect<ReadonlyArray<string>, GenerateIOError> =>
  Effect.gen(function* () {
    const specPath = c.path.join(c.folder, "SPEC.md");
    const sidecarDir = c.path.join(c.folder, ".safer-spec");
    const sidecarPath = c.path.join(sidecarDir, `${sidecarSlug(c.folder)}.json`);
    yield* c.fs.makeDirectory(sidecarDir, { recursive: true })
      .pipe(Effect.catchAll(() => Effect.succeed(void 0)));
    yield* c.fs.writeFileString(specPath, c.markdown)
      .pipe(Effect.mapError(ioToGenerate(c.folder, specPath)));
    yield* c.fs.writeFileString(sidecarPath, c.sidecarJson)
      .pipe(Effect.mapError(ioToGenerate(c.folder, sidecarPath)));
    return [specPath, sidecarPath];
  });

const resolveFolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  input: GenerateInput,
): Effect.Effect<ReadonlyArray<FolderPath>, GenerateError> => {
  const oneFolder = Option.isSome(input.folder)
    ? FolderPath(normalizeFolder(input.folder.value)) : null;
  if (input.watch) {
    return Effect.fail(new GenerateError({
      folder: oneFolder ?? FolderPath("<none>"), reason: "--watch not yet implemented",
    }));
  }
  return oneFolder !== null
    ? Effect.succeed([oneFolder])
    : discoverFolders(fs, path, ".").pipe(Effect.map((ds) => ds.map(FolderPath)));
};

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
  GenerateAnyError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folders = yield* resolveFolders(fs, path, input);
    if (folders.length === 0) {
      return yield* Effect.fail(
        new GenerateError({
          folder: FolderPath("<none>"),
          reason: "no folders to generate (no `index.ts` barrel under the project root)",
        }),
      );
    }
    const ctx = yield* loadProjectContext(fs, path, ".").pipe(
      Effect.catchTag("ProjectContextError", (e) =>
        Effect.die(new Error(`failed to load project context: ${e.cause}`)),
      ),
      Effect.catchTag("ConfigError", (e) =>
        Effect.die(new Error(`safer-spec.config.json at ${e.path} is invalid: ${e.cause}`)),
      ),
    );
    const bx: BuildCtx = { fs, path, ctx, knownExports: collectKnownExports(ctx) };
    const written: string[] = [];
    for (const folder of folders) {
      const analysis = yield* buildAnalysis(bx, folder);
      // Generate emits the committed artifact; execution metrics are
      // untracked test-run output. Folding them in here would make
      // committed SPEC.md depend on whether Vitest happened to run
      // locally. `validate --implemented` reads execution sidecars in
      // memory and gates against thresholds without touching disk.
      const meta = buildSpecMeta(analysis, ctx, null);
      const markdown = emitMarkdown(analysis, meta);
      const sidecarJson = yield* renderSidecar(buildSpecArtifact(analysis, meta), folder);
      if (!input.write || input.dryRun) {
        yield* Effect.log(`--- SPEC.md (${folder}) ---\n${markdown}`);
        yield* Effect.log(`--- sidecar (${folder}) ---\n${sidecarJson}`);
      } else {
        const w = yield* writeOutputs({ fs, path, folder, markdown, sidecarJson });
        written.push(...w);
      }
    }
    return {
      foldersTouched: folders,
      filesWritten: written,
      diff: `wrote ${written.length} files across ${folders.length} folders`,
    };
  }).pipe(Effect.withSpan("commands/generate"));
