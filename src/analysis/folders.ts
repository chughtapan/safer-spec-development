/**
 * @spec.purpose Pure helper for the `## Children` section of an emitted
 *   MODULE.md. Merges immediate SPEC'd subfolders with the folder's sources
 *   and tests into a flat, alphabetically-sorted entry list. Consumed by
 *   `analysis/pipeline.ts`'s `inspectFolder` and `analysis/orchestrate.ts`'s
 *   `buildAnalysis`; not re-exported via the analysis barrel since
 *   `FolderAnalysis.children` is the public-facing data shape.
 */

import type { Path } from "@effect/platform";

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
 *   reason: visual cue for readers; subfolder links target the nested MODULE.md,
 *           file links target the relative file path.
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
      display: `${name}/`, link: `./${name}/MODULE.md`,
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
