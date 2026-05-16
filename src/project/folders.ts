/**
 * @spec.purpose Folder-discovery helpers used by `generate` and `validate`:
 *   recursive walk for the no-`--folder` mode (`discoverFolders`),
 *   immediate-children walk for the parent SPEC.md's `## Children` section
 *   (`discoverImmediateSubfolders`), and the `buildChildren` helper that
 *   composes the merged file + subfolder list emit consumes. Extracted
 *   from `validate-pipeline.ts` so each file fits the strict max-lines cap.
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs.readDirectory(dir).pipe(
    Effect.map((es) => [...es].sort()),
    Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
  );

const isDirectory = (
  fs: FileSystem.FileSystem,
  full: string,
): Effect.Effect<boolean, never> =>
  fs.stat(full).pipe(
    Effect.map((s) => s.type === "Directory"),
    Effect.catchAll(() => Effect.succeed(false)),
  );

const SKIP_DIRS_DISCOVERY: ReadonlySet<string> = new Set([
  "__tests__", "node_modules", "dist", "build", "coverage", ".safer-spec",
]);

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
      if (name.startsWith(".") || SKIP_DIRS_DISCOVERY.has(name)) continue;
      const full = path.join(dir, name);
      if (yield* isDirectory(fs, full)) yield* walkOnce(fs, path, full, out);
    }
  });

/**
 * @spec.guarantee "returns every directory under `root` containing an `index.ts` barrel; insertion order is root-first depth-first"
 *   reason: contract; both `generate` and `validate` iterate this list when
 *           no `--folder` is given. Walking from `.` finds barrels under any
 *           top-level layout (`src/`, `packages/&lt;name>/`, app workspaces).
 * @spec.residual-contract "dot-prefixed directories, `__tests__`, `node_modules`, `dist`, `build`, `coverage`, and `.safer-spec` are skipped; symlinks are not followed"
 *   reason: avoid vendored dependencies, build output, and sidecar dirs.
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
  }).pipe(Effect.withSpan("commands/folder-discovery/discoverFolders"));

/**
 * @spec.guarantee "returns immediate child directories of `folder` that contain an `index.ts` barrel; not recursive"
 *   reason: parent SPEC.md's `## Children` section lists immediate nested
 *           SPEC'd domains; deeper nesting belongs to each subfolder's own SPEC.
 */
export const discoverImmediateSubfolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  Effect.gen(function* () {
    const entries = yield* readDirSafe(fs, folder);
    const out: string[] = [];
    for (const name of entries) {
      if (name.startsWith(".") || SKIP_DIRS_DISCOVERY.has(name)) continue;
      const full = path.join(folder, name);
      if (yield* isDirectory(fs, full)) {
        const subEntries = yield* readDirSafe(fs, full);
        if (subEntries.includes("index.ts")) out.push(full);
      }
    }
    return out;
  }).pipe(Effect.withSpan("commands/folder-discovery/discoverImmediateSubfolders"));

export interface BuildChildrenArgs {
  readonly folder: string;
  readonly sources: ReadonlyArray<string>;
  readonly tests: ReadonlyArray<string>;
  readonly subfolders: ReadonlyArray<string>;
  readonly purposeByPath: ReadonlyMap<string, string>;
  readonly path: Path.Path;
}

/**
 * @spec.guarantee "result emits in three concatenated groups: immediate SPEC'd subfolders (alphabetic), source files (alphabetic), then test files (alphabetic)"
 *   reason: implementation surface (subfolders + sources) leads
 *           `## Children`; tests are secondary documentation grouped at
 *           the end so the section reads as primary-then-secondary.
 * @spec.residual-contract "files are displayed by their path relative to the folder; subfolders are displayed with a trailing slash"
 *   reason: visual cue for readers; subfolder links target `&lt;sub>/SPEC.md`,
 *           file links target `./&lt;rel>`.
 */
export const buildChildren = (
  args: BuildChildrenArgs,
): ReadonlyArray<{ display: string; link: string; purpose: string | null }> => {
  const { folder, sources, tests, subfolders, purposeByPath, path } = args;
  const rel = (p: string): string =>
    p.startsWith(`${folder}/`) ? p.slice(folder.length + 1) : p;
  const fileEntry = (p: string) => ({
    display: rel(p), link: `./${rel(p)}`, purpose: purposeByPath.get(p) ?? null,
  });
  const subEntry = (sub: string) => {
    const name = path.basename(sub);
    return {
      display: `${name}/`, link: `./${name}/SPEC.md`,
      purpose: purposeByPath.get(path.join(sub, "index.ts")) ?? null,
    };
  };
  const byDisplay = (a: { display: string }, b: { display: string }) =>
    a.display.localeCompare(b.display);
  return [
    ...subfolders.map(subEntry).sort(byDisplay),
    ...sources.map(fileEntry).sort(byDisplay),
    ...tests.map(fileEntry).sort(byDisplay),
  ];
};
