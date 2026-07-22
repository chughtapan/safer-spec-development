/**
 * @spec.purpose Shared analysis pipeline for `validate`. Walks the same
 *   inputs as `generate` (sources, tests, index barrel) and returns the
 *   `FolderAnalysis` that the markdown emitter consumes plus the per-test
 *   issues list (`ItSpecIssue[]`) that `validate.ts` maps to its
 *   gap-class exit codes.
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";
import {
  parseFileDirectives,
  type JsDocDirectiveOverflowError,
  type JsDocDirectiveParseError,
  type JsDocUnknownDirectiveError,
  type LocatedDirective,
} from "@safer/spec/grammar/index.js";
import {
  type FolderAnalysis,
  type PropertyRow,
} from "@safer/spec/artifact/index.js";
import {
  buildExportEntries,
  collectExports,
  indexFilePurposes,
  uniqueExternalSources,
} from "@safer/analysis/exports.js";
import { extractProperties, type ItSpecIssue } from "@safer/analysis/properties.js";
import { buildChildren } from "@safer/analysis/folders.js";
import type { ProjectContext } from "@safer/project/index.js";

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
  fs.readDirectory(dir).pipe(
    Effect.map((entries) => [...entries].sort()),
    Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
  );

/**
 * @spec.guarantee "returns folder inputs (sources, tests, index path) or null if no index.ts barrel exists"
 *   reason: contract for validate's per-folder iteration.
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

interface TestParseResult {
  readonly rows: ReadonlyArray<PropertyRow>;
  readonly issues: ReadonlyArray<ItSpecIssue>;
  readonly directives: ReadonlyArray<LocatedDirective>;
}

// The folder-scoped export-name set feeds validate's stale-directive gate.
// The project-wide set is computed once by the command boundary and passed
// through InspectArgs so every folder does not rebuild it.
const exportNamesFrom = (
  ctx: ProjectContext,
  paths: ReadonlySet<string> | null,
): ReadonlySet<string> => {
  const out = new Set<string>();
  for (const sf of ctx.sources) {
    if (paths !== null && !paths.has(sf.path)) continue;
    for (const d of collectExports(sf.path, sf.source, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    })) {
      out.add(d.name);
      out.add(d.declaredName);
    }
  }
  return out;
};

const folderExportNames = (
  sources: ReadonlyArray<string>,
  ctx: ProjectContext,
): ReadonlySet<string> => exportNamesFrom(ctx, new Set(sources));

const parseTests = (
  fs: FileSystem.FileSystem,
  tests: ReadonlyArray<string>,
  declaredExports: ReadonlySet<string>,
): Effect.Effect<TestParseResult, DirectiveParseError> =>
  Effect.gen(function* () {
    const rows: PropertyRow[] = [];
    const issues: ItSpecIssue[] = [];
    const directives: LocatedDirective[] = [];
    for (const p of tests) {
      const src = yield* readSource(fs, p);
      const parsed = yield* parseFileDirectives(p, src);
      directives.push(...parsed);
      const r = extractProperties(p, src, parsed, declaredExports);
      rows.push(...r.rows);
      issues.push(...r.issues);
    }
    return { rows, issues, directives };
  });

export interface FolderInspection {
  readonly analysis: FolderAnalysis;
  readonly issues: ReadonlyArray<ItSpecIssue>;
}

export interface InspectArgs {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: string;
  readonly inputs: FolderInputs;
  readonly ctx: ProjectContext;
  readonly knownExports: ReadonlySet<string>;
}

/**
 * @spec.guarantee "produces the same FolderAnalysis shape `generate` emits plus a per-test issues list; regenerate-and-compare on `analysis` is byte-deterministic"
 *   reason: roundtrip contract; validate's drift check relies on it.
 */
export const inspectFolder = ({
  fs,
  path,
  folder,
  inputs,
  ctx,
  knownExports,
}: InspectArgs): Effect.Effect<FolderInspection, DirectiveParseError> =>
  Effect.gen(function* () {
    const indexFile = ctx.sources.find((s) => s.path === inputs.indexFilePath);
    const indexSrc = indexFile?.source ?? (yield* readSource(fs, inputs.indexFilePath));
    const declarations = collectExports(inputs.indexFilePath, indexSrc, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    });
    const externalSources = uniqueExternalSources(declarations, inputs.sources);
    const localDirectives = yield* parseSources(fs, inputs.sources);
    const externalDirectives = yield* parseSources(fs, externalSources);
    const directives = [...localDirectives, ...externalDirectives];
    const tests = yield* parseTests(fs, inputs.tests, knownExports);
    const subfolders = ctx.subfoldersOf(folder);
    const subDirectives = yield* parseSources(fs, subfolders.map((s) => path.join(s, "index.ts")));
    const purposeByPath = indexFilePurposes([
      ...directives, ...tests.directives, ...subDirectives,
    ]);
    const children = buildChildren({
      folder, sources: inputs.sources, tests: inputs.tests, subfolders, purposeByPath, path,
    });
    const built = buildExportEntries(declarations, directives, {
      folderKnownExports: folderExportNames(inputs.sources, ctx),
      localSources: new Set(inputs.sources),
    });
    const unmatchedIssues: ReadonlyArray<ItSpecIssue> = built.unmatched.map((d) => ({
      kind: "directive-mismatch",
      path: d.location.path,
      line: d.location.line,
      detail: `@spec.${d.directive._tag} on "${d.location.exportName ?? "?"}" does not match any export in this folder`,
    }));
    return {
      analysis: {
        folder,
        purpose: purposeByPath.get(inputs.indexFilePath) ?? null,
        exports: built.entries,
        properties: tests.rows,
        children,
      },
      issues: [...tests.issues, ...unmatchedIssues],
    };
  }).pipe(Effect.withSpan("commands/validate-pipeline/inspectFolder"));

