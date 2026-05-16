/**
 * @spec.purpose Property stubs for the SPEC.md `## Children` section and
 *   the per-file rendering invariants. Splits out of `emit.spec.test.ts`
 *   to stay under the per-file line cap; both files cover `emitMarkdown`.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  emitMarkdown,
  type FolderAnalysis,
  type SpecMeta,
} from "@safer/spec/artifact/emit.js";

class EmitChildrenAssertionError extends Data.TaggedError(
  "EmitChildrenAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, EmitChildrenAssertionError> =>
  cond ? Effect.fail(new EmitChildrenAssertionError({ detail })) : Effect.void;

const FIXED_META: SpecMeta = {
  generatedAtSha: "0000000",
  coverage: {
    typeCoverage: 0.5,
    classifierCoverage: null,
    preconditionPassRate: null,
    branchCoverageFromSpecTests: null,
  },
  thresholds: { typeCoverage: 0, classifierCoverage: 0, preconditionPassRate: 0 },
  generatedFrom: {
    jsdoc: "@spec.*",
    exports: "ts-morph",
    schemas: [],
    properties: [],
    eslint: "agent-code-guard",
  },
};

const baseAnalysis = (folder: string): FolderAnalysis => ({
  folder,
  purpose: "p",
  exports: [],
  properties: [],
  children: [],
});

interface ChildSeed {
  readonly subfolderName: string;
  readonly sourceFile: string;
  readonly testFile: string;
  readonly purpose: string;
}

const childSeedArb: fc.Arbitrary<ChildSeed> = fc.record({
  subfolderName: fc.stringMatching(/^[a-z][a-z-]{1,8}$/),
  sourceFile: fc.stringMatching(/^[a-z][a-z-]{1,8}\.ts$/),
  testFile: fc.stringMatching(/^[a-z][a-z-]{1,8}\.spec\.test\.ts$/),
  purpose: fc.stringMatching(/^[a-z][a-z ]{2,30}$/),
});

/**
 * @spec.property emit-children-section-mixes-subfolders-files-tests
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim `## Children` lists immediate SPEC'd subfolders (linking to `&lt;sub>/SPEC.md`) before source files before tests; each row carries the file or subfolder `@spec.purpose` body when present
 */
itSpec.prop(
  "emit-children-section-mixes-subfolders-files-tests",
  { type: "Inclusion", exports: [emitMarkdown] },
  childSeedArb,
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = {
          ...baseAnalysis("src/sample"),
          children: [
            { display: `${s.subfolderName}/`, link: `./${s.subfolderName}/SPEC.md`, purpose: s.purpose },
            { display: s.sourceFile, link: `./${s.sourceFile}`, purpose: null },
            { display: s.testFile, link: `./${s.testFile}`, purpose: null },
          ],
        };
        const out = emitMarkdown(analysis, FIXED_META);
        const idxSub = out.indexOf(`${s.subfolderName}/`);
        const idxSrc = out.indexOf(s.sourceFile);
        const idxTest = out.indexOf(s.testFile);
        yield* failIf(idxSub === -1 || idxSrc === -1 || idxTest === -1, `child missing in output`);
        yield* failIf(idxSub > idxSrc || idxSrc > idxTest, `child order wrong`);
        yield* failIf(
          !out.includes(s.purpose),
          `subfolder purpose not rendered: ${JSON.stringify(s.purpose)}`,
        );
      }),
    ),
);

/**
 * @spec.property emit-root-folder-spec-links-stay-in-repo
 * @spec.type Constant Equality
 * @spec.exports emitMarkdown
 * @spec.claim a SPEC.md at the repo root (`folder === "."`) reaches every file via `./&lt;target>`; `relativeToFolder` never emits `../...` for the root sentinel
 */
itSpec.prop(
  "emit-root-folder-spec-links-stay-in-repo",
  { type: "Constant Equality", exports: [emitMarkdown] },
  fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/),
  (exportName) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = {
          ...baseAnalysis("."),
          exports: [
            {
              name: exportName, kind: "const", signature: "", description: "",
              sourceRef: { path: "src/sample.ts", line: 1 },
              assumes: [], guarantees: [], residualContract: null, skipped: [],
            },
          ],
        };
        const out = emitMarkdown(analysis, FIXED_META);
        yield* failIf(
          out.includes("../"),
          `root SPEC.md emitted ../ link: ${out.split("\n").find((l) => l.includes("../")) ?? ""}`,
        );
      }),
    ),
);

/**
 * @spec.property emit-properties-table-cells-are-code-span-safe
 * @spec.type Constant Bounds Checking
 * @spec.exports emitMarkdown
 * @spec.claim a backtick (or other markdown markup) inside a property `id` / `exports` cell never closes the surrounding code span; the table grammar (column count, row terminator) survives any author-controlled directive content
 */
itSpec.prop(
  "emit-properties-table-cells-are-code-span-safe",
  { type: "Constant Bounds Checking", exports: [emitMarkdown] },
  fc.stringMatching(/^[a-zA-Z0-9_` *|<>-]{1,32}$/),
  (rawId) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = {
          ...baseAnalysis("src/sample"),
          properties: [
            {
              id: rawId,
              propertyType: "Roundtrip",
              exports: ["foo"],
              claim: "claim body",
              sourceRef: { path: "src/sample/index.spec.test.ts", line: 1 },
              stubbed: false,
            },
          ],
        };
        const out = emitMarkdown(analysis, FIXED_META);
        // Find the property row line; must have 5 pipes (6 columns).
        const row = out.split("\n").find((l) => l.startsWith("| `"));
        yield* failIf(row === undefined, `no property row in output`);
        if (row === undefined) return;
        // Pipe count (un-escaped); count `|` that aren't preceded by `\`.
        let pipes = 0;
        for (let i = 0; i < row.length; i += 1) {
          if (row[i] === "|" && row[i - 1] !== "\\") pipes += 1;
        }
        yield* failIf(
          pipes !== 6,
          `expected 6 unescaped pipes (5 cells); got ${pipes} in ${JSON.stringify(row)}`,
        );
      }),
    ),
);

/**
 * @spec.property emit-file-purpose-rendered-with-link
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim every entry in `## Children` for a file with a top-of-file `@spec.purpose` renders as `[\`&lt;rel-path>\`](./&lt;rel-path>) — &lt;purpose body>`; files without `@spec.purpose` render as link-only
 */
itSpec.prop(
  "emit-file-purpose-rendered-with-link",
  { type: "Inclusion", exports: [emitMarkdown] },
  fc.record({
    file: fc.stringMatching(/^[a-z][a-z-]{1,8}\.ts$/),
    purpose: fc.stringMatching(/^[a-z][a-z ]{2,16}$/),
  }),
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = {
          ...baseAnalysis("src/sample"),
          children: [
            { display: s.file, link: `./${s.file}`, purpose: s.purpose },
            { display: "bare.ts", link: "./bare.ts", purpose: null },
          ],
        };
        const out = emitMarkdown(analysis, FIXED_META);
        const withPurposeLine = out
          .split("\n")
          .find((l) => l.includes(`\`${s.file}\``));
        const linkOnlyLine = out
          .split("\n")
          .find((l) => l.includes("`bare.ts`"));
        yield* failIf(
          withPurposeLine === undefined || !withPurposeLine.includes(` — ${s.purpose}`),
          `purpose not rendered: ${JSON.stringify(withPurposeLine)}`,
        );
        yield* failIf(
          linkOnlyLine === undefined || linkOnlyLine.includes(" — "),
          `bare entry should be link-only: ${JSON.stringify(linkOnlyLine)}`,
        );
      }),
    ),
);
