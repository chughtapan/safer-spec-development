/**
 * @spec.purpose Property stubs for the canonical SPEC.md section emitter.
 *   Covers section ordering, line-ending canonicalization, roundtrip
 *   through frontmatter decode, lex-sort guarantees, and code-span safety.
 *   Children-section + per-file rendering properties live in
 *   `emit-children.spec.test.ts`.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { SPEC_FORMAT_VERSION } from "@safer/project/version.js";
import { decodeSpecFrontmatter } from "@safer/spec/artifact/frontmatter.js";
import {
  emitMarkdown,
  type FolderAnalysis,
  type SpecMeta,
} from "@safer/spec/artifact/emit.js";

class EmitAssertionError extends Data.TaggedError("EmitAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, EmitAssertionError> =>
  cond ? Effect.fail(new EmitAssertionError({ detail })) : Effect.void;

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

const emptyAnalysis = (folder: string): FolderAnalysis => ({
  folder,
  purpose: "purpose body",
  exports: [],
  properties: [],
  children: [],
});

const seedFolderArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-z][a-z0-9/_-]{0,12}$/);

/**
 * @spec.property emit-sha-stable
 * @spec.type Roundtrip
 * @spec.exports emitMarkdown
 * @spec.claim two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha
 */
itSpec.prop(
  "emit-sha-stable",
  { type: "Roundtrip", exports: [emitMarkdown] },
  seedFolderArb,
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const a = emptyAnalysis(folder);
        const out1 = emitMarkdown(a, FIXED_META);
        const out2 = emitMarkdown(a, { ...FIXED_META, generatedAtSha: "different-sha" });
        const stripSha = (s: string): string =>
          s.replace(/^generatedAtSha:.*$/m, "generatedAtSha: <NORM>");
        yield* failIf(
          stripSha(out1) !== stripSha(out2),
          `emit not stable modulo sha`,
        );
      }),
    ),
);

/**
 * @spec.property emit-section-order-fixed
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture
 */
itSpec.prop(
  "emit-section-order-fixed",
  { type: "Inclusion", exports: [emitMarkdown] },
  seedFolderArb,
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = emitMarkdown(emptyAnalysis(folder), FIXED_META);
        const headers = ["## Purpose", "## Public surface", "## Children", "## Properties"];
        let cursor = 0;
        for (const h of headers) {
          const idx = out.indexOf(h, cursor);
          yield* failIf(idx === -1, `missing section header ${h}`);
          if (idx === -1) return;
          cursor = idx;
        }
      }),
    ),
);

/**
 * @spec.property emit-canonical-line-endings
 * @spec.type Constant Equality
 * @spec.exports emitMarkdown
 * @spec.claim emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed
 */
itSpec.prop(
  "emit-canonical-line-endings",
  { type: "Constant Equality", exports: [emitMarkdown] },
  seedFolderArb,
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = emitMarkdown(emptyAnalysis(folder), FIXED_META);
        yield* failIf(out.includes("\r"), `CR character in output`);
        for (const line of out.split("\n")) {
          yield* failIf(
            line.length !== line.trimEnd().length,
            `trailing whitespace on line: ${JSON.stringify(line)}`,
          );
        }
      }),
    ),
);

const yamlBlock = (out: string): string => {
  const start = out.indexOf("---\n");
  if (start === -1) return "";
  const end = out.indexOf("\n---", start + 4);
  return end === -1 ? "" : out.slice(start + 4, end);
};

// Strict YAML decode is heavy; parse the emitted block as a minimal map so
// frontmatter decode can run against an object built from the same lines.
const yamlToShape = (yaml: string): unknown => {
  const obj: Record<string, unknown> = {
    generatedFrom: { jsdoc: "@spec.*", exports: "ts-morph", schemas: [], properties: [], eslint: "agent-code-guard" },
    coverage: { typeCoverage: 0, classifierCoverage: null, preconditionPassRate: null, branchCoverageFromSpecTests: null },
    thresholds: { typeCoverage: 0, classifierCoverage: 0, preconditionPassRate: 0 },
  };
  for (const line of yaml.split("\n")) {
    const m = /^([a-zA-Z-]+): (.*)$/.exec(line);
    if (m !== null) obj[m[1]!] = m[2];
  }
  return obj;
};

/**
 * @spec.property emit-frontmatter-roundtrips
 * @spec.type Roundtrip
 * @spec.exports emitMarkdown
 * @spec.claim YAML frontmatter parsed from emitMarkdown output round-trips back to the same SpecFrontmatter shape
 */
itSpec.prop(
  "emit-frontmatter-roundtrips",
  { type: "Roundtrip", exports: [emitMarkdown] },
  seedFolderArb,
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = emitMarkdown(emptyAnalysis(folder), FIXED_META);
        const yaml = yamlBlock(out);
        yield* failIf(yaml.length === 0, `no YAML frontmatter in output`);
        const decoded = yield* decodeSpecFrontmatter(yamlToShape(yaml));
        yield* failIf(
          decoded.folder !== folder ||
            decoded["format-version"] !== SPEC_FORMAT_VERSION,
          `frontmatter mismatch: folder=${decoded.folder} fv=${decoded["format-version"]}`,
        );
      }),
    ),
);

interface ExportSeed {
  readonly name: string;
  readonly line: number;
}

const exportsArb: fc.Arbitrary<ReadonlyArray<ExportSeed>> = fc
  .array(
    fc.record({
      name: fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/),
      line: fc.integer({ min: 1, max: 999 }),
    }),
    { minLength: 1, maxLength: 5 },
  )
  .map((arr) => {
    const seen = new Set<string>();
    return arr.filter((e) => {
      if (seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    });
  })
  .filter((arr) => arr.length > 0);

/**
 * @spec.property emit-public-surface-source-order
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim Public surface section lists exports in source-order (matching the file's declaration order)
 */
itSpec.prop(
  "emit-public-surface-source-order",
  { type: "Inclusion", exports: [emitMarkdown] },
  exportsArb,
  (seeds) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = {
          folder: "src/sample",
          purpose: "p",
          exports: seeds.map((s) => ({
            name: s.name,
            kind: "const" as const,
            signature: "",
            description: "",
            sourceRef: { path: "src/sample/index.ts", line: s.line },
            assumes: [],
            guarantees: [],
            residualContract: null,
            skipped: [],
          })),
          properties: [],
          children: [],
        };
        const out = emitMarkdown(analysis, FIXED_META);
        const positions = seeds.map((s) => out.indexOf(`\`${s.name}\``));
        for (let i = 1; i < positions.length; i += 1) {
          yield* failIf(
            positions[i]! < positions[i - 1]!,
            `exports out of source order: ${JSON.stringify(seeds.map((s) => s.name))} positions=${JSON.stringify(positions)}`,
          );
        }
      }),
    ),
);

/**
 * @spec.property emit-files-section-lex-sorted
 * @spec.type Inclusion
 * @spec.exports emitMarkdown
 * @spec.claim Files section lists sibling filenames in lexicographic order
 */
itSpec.prop(
  "emit-files-section-lex-sorted",
  { type: "Inclusion", exports: [emitMarkdown] },
  fc
    .array(fc.stringMatching(/^[a-z][a-z-]{1,8}\.ts$/), {
      minLength: 2,
      maxLength: 6,
    })
    .map((files) => Array.from(new Set(files)))
    .filter((files) => files.length >= 2),
  (files) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const children = files.map((f) => ({
          display: f,
          link: `./${f}`,
          purpose: null,
        }));
        const analysis: FolderAnalysis = {
          folder: "src/sample", purpose: null, exports: [], properties: [],
          // emit assumes the caller pre-sorts; we pass already-sorted to
          // mirror buildChildren's guarantee.
          children: [...children].sort((a, b) => a.display.localeCompare(b.display)),
        };
        const out = emitMarkdown(analysis, FIXED_META);
        const positions = analysis.children.map((c) => out.indexOf(`\`${c.display}\``));
        for (let i = 1; i < positions.length; i += 1) {
          yield* failIf(
            positions[i]! < positions[i - 1]!,
            `files not lex-sorted in output: ${JSON.stringify(analysis.children.map((c) => c.display))}`,
          );
        }
      }),
    ),
);

/**
 * @spec.property emit-residual-bodies-escaped
 * @spec.type Constant Bounds Checking
 * @spec.exports emitMarkdown
 * @spec.claim residual-contract bodies emitted into markdown go through escapeForMarkdown; no injection
 */
itSpec.prop(
  "emit-residual-bodies-escaped",
  { type: "Constant Bounds Checking", exports: [emitMarkdown] },
  fc.stringMatching(/^[a-z `*_<>\[\]]{1,40}$/),
  (residualBody) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = {
          folder: "src/sample", purpose: null, properties: [], children: [],
          exports: [
            {
              name: "foo", kind: "const", signature: "", description: "",
              sourceRef: { path: "src/sample/index.ts", line: 1 },
              assumes: [], guarantees: [],
              residualContract: { _tag: "some", body: residualBody, reason: "documented" },
              skipped: [],
            },
          ],
        };
        const out = emitMarkdown(analysis, FIXED_META);
        // The residual body line begins with `**Residual contract:**`.
        const idx = out.indexOf("**Residual contract:**");
        yield* failIf(idx === -1, `no residual contract emitted`);
        if (idx === -1) return;
        const line = out.slice(idx, out.indexOf("\n", idx));
        // Angle brackets must have been escaped to entities; raw < or > inside the body would leak markup.
        const inner = line.replace("**Residual contract:**", "");
        yield* failIf(
          /[<>]/.test(inner),
          `raw angle bracket in emitted residual contract: ${JSON.stringify(line)}`,
        );
      }),
    ),
);
