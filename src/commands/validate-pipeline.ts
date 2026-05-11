/**
 * @spec.purpose Shared analysis pipeline for `validate`. Walks the same
 *   inputs as `generate` (sources, tests, index barrel) and returns the
 *   `FolderAnalysis` that the markdown emitter consumes. Factored out so
 *   `validate.ts` stays focused on gate-class semantics rather than file
 *   IO + parse plumbing, and so the cognitive-complexity / file-size lints
 *   in the strict eslint config remain satisfied.
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";
import {
  parseFileDirectives,
  type JsDocDirectiveOverflowError,
  type JsDocDirectiveParseError,
  type JsDocUnknownDirectiveError,
  type LocatedDirective,
} from "@safer/spec/directives/index.js";
import {
  emitMarkdown,
  type FolderAnalysis,
  type PropertyRow,
} from "@safer/spec/emit.js";
import {
  buildExportEntries,
  collectExports,
  findPurpose,
} from "@safer/spec/source-exports.js";
import { extractProperties } from "@safer/spec/todos.js";

type DirectiveParseError =
  | JsDocDirectiveOverflowError
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError;

export interface FolderInputs {
  readonly sources: ReadonlyArray<string>;
  readonly tests: ReadonlyArray<string>;
  readonly indexFilePath: string;
}

const isTestFile = (name: string): boolean => name.endsWith(".spec.test.ts");
const isSourceFile = (name: string): boolean =>
  name.endsWith(".ts") && !isTestFile(name) && !name.endsWith(".d.ts");

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs
    .readDirectory(dir)
    .pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)));

const isDirectory = (
  fs: FileSystem.FileSystem,
  full: string,
): Effect.Effect<boolean, never> =>
  fs.stat(full).pipe(
    Effect.map((s) => s.type === "Directory"),
    Effect.catchAll(() => Effect.succeed(false)),
  );

/**
 * @spec.guarantee "returns folder inputs (sources, tests, index path) or null if no index.ts barrel exists"
 *   reason: contract for validate's per-folder iteration.
 * @spec.residual-contract "test files under `__tests__/` are scanned as a sibling subdirectory only; nested test dirs are ignored"
 *   reason: scope-of-this-slice contract.
 */
export const collectFolderInputs = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<FolderInputs | null, never> =>
  Effect.gen(function* () {
    const entries = yield* readDirSafe(fs, folder);
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
    const indexFilePath = sources.find((p) => path.basename(p) === "index.ts");
    if (indexFilePath === undefined) return null;
    return { sources, tests, indexFilePath };
  }).pipe(Effect.withSpan("commands/validate-pipeline/collectFolderInputs"));

const orDieFile = (path: string) =>
  Effect.catchAll((cause: unknown) =>
    Effect.die(new Error(`cannot read ${path}: ${String(cause)}`)),
  );

const readSource = (
  fs: FileSystem.FileSystem,
  path: string,
): Effect.Effect<string, never> =>
  fs.readFileString(path).pipe(orDieFile(path));

const parseSources = (
  fs: FileSystem.FileSystem,
  sources: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<LocatedDirective>, DirectiveParseError> =>
  Effect.gen(function* () {
    const all: LocatedDirective[] = [];
    for (const p of sources) {
      const src = yield* readSource(fs, p);
      all.push(...(yield* parseFileDirectives(p, src)));
    }
    return all;
  });

const parseTests = (
  fs: FileSystem.FileSystem,
  tests: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<PropertyRow>, DirectiveParseError> =>
  Effect.gen(function* () {
    const rows: PropertyRow[] = [];
    for (const p of tests) {
      const src = yield* readSource(fs, p);
      const parsed = yield* parseFileDirectives(p, src);
      rows.push(...extractProperties(p, src, parsed));
    }
    return rows;
  });

/**
 * @spec.guarantee "produces the same FolderAnalysis shape that `generate` emits, so a regenerate-and-compare check is byte-deterministic"
 *   reason: roundtrip contract; validate's drift check relies on it.
 * @spec.residual-contract none
 *   reason: pure data assembly; behavior captured by signature.
 */
export const buildFolderAnalysis = (
  fs: FileSystem.FileSystem,
  folder: string,
  inputs: FolderInputs,
): Effect.Effect<FolderAnalysis, DirectiveParseError> =>
  Effect.gen(function* () {
    const directives = yield* parseSources(fs, inputs.sources);
    const indexSrc = yield* readSource(fs, inputs.indexFilePath);
    const declarations = collectExports(inputs.indexFilePath, indexSrc);
    const properties = yield* parseTests(fs, inputs.tests);
    return {
      folder,
      purpose: findPurpose(directives, inputs.indexFilePath),
      exports: buildExportEntries(declarations, directives),
      properties,
      sourceFiles: inputs.sources,
      testFiles: inputs.tests,
    };
  }).pipe(Effect.withSpan("commands/validate-pipeline/buildFolderAnalysis"));

/**
 * @spec.guarantee "alias for `emitMarkdown(analysis)`; isolated so validate.ts only depends on one symbol from emit"
 *   reason: surface minimization; keeps validate's import block compact.
 * @spec.residual-contract none
 *   reason: pure re-export.
 */
export const regenerateMarkdown = (analysis: FolderAnalysis): string =>
  emitMarkdown(analysis);

const walkOnce = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
  out: string[],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const entries = yield* readDirSafe(fs, dir);
    if (entries.includes("index.ts")) out.push(dir);
    for (const name of entries) {
      if (name === "__tests__" || name.startsWith(".")) continue;
      const full = path.join(dir, name);
      if (yield* isDirectory(fs, full)) yield* walkOnce(fs, path, full, out);
    }
  });

/**
 * @spec.guarantee "returns every directory under `root` that contains an `index.ts` barrel"
 *   reason: contract; validate iterates this list when no `--folder` is given.
 * @spec.residual-contract "dot-prefixed directories and `__tests__` are skipped; symlinks are not followed"
 *   reason: scope-of-this-slice contract.
 */
export const discoverFolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  Effect.gen(function* () {
    const out: string[] = [];
    yield* walkOnce(fs, path, root, out);
    return out;
  }).pipe(Effect.withSpan("commands/validate-pipeline/discoverFolders"));
