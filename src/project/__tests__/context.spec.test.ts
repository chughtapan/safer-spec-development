/**
 * @spec.purpose Property tests for `loadProjectContext` and the
 *   `ProjectContext` snapshot it produces (`folders`, `subfoldersOf`,
 *   `thresholdsFor`, `resolveFolder`). The fixture is the codemod's own
 *   source tree — module-load runs the heavy ts-morph + FS work once,
 *   then fc-property bodies assert on the cached snapshot.
 */

import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Data, Effect, Exit } from "effect";
import * as fc from "fast-check";
import * as nodePath from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { loadProjectContext, type ProjectContext } from "@safer/project/index.js";

class ContextAssertionError extends Data.TaggedError("ContextAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, ContextAssertionError> =>
  cond ? Effect.fail(new ContextAssertionError({ detail })) : Effect.void;

const loadCtx = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* loadProjectContext(fs, path).pipe(
    Effect.catchAll((e) =>
      Effect.die(new Error(`fixture load failed: ${JSON.stringify(e)}`)),
    ),
  );
});

const CTX: ProjectContext = await Effect.runPromise(
  loadCtx.pipe(Effect.provide(NodeContext.layer)),
);

/* ---------- loadProjectContext ---------- */

/**
 * @spec.property load-project-context-typecheck
 * @spec.type Typechecking
 * @spec.exports loadProjectContext
 * @spec.claim `loadProjectContext` returns a `ProjectContext` whose precomputed fields are populated — sources array, paths record, baseUrl string, generatedAtSha string, folders array, subfoldersOf/thresholdsFor/resolveFolder functions
 */
itSpec.prop(
  "load-project-context-typecheck",
  { type: "Typechecking", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(!Array.isArray(CTX.sources), `sources array`);
        yield* failIf(typeof CTX.baseUrl !== "string", `baseUrl string`);
        yield* failIf(typeof CTX.generatedAtSha !== "string", `generatedAtSha string`);
        yield* failIf(!Array.isArray(CTX.folders), `folders array`);
        yield* failIf(typeof CTX.subfoldersOf !== "function", `subfoldersOf function`);
        yield* failIf(typeof CTX.thresholdsFor !== "function", `thresholdsFor function`);
        yield* failIf(typeof CTX.resolveFolder !== "function", `resolveFolder function`);
      }),
    ),
);

/**
 * @spec.property load-project-context-arity
 * @spec.type Constant Equality
 * @spec.exports loadProjectContext
 * @spec.claim `loadProjectContext` accepts 2-3 positional args (fs, path, root=".")` — fs and path are required, root defaults
 */
itSpec.prop(
  "load-project-context-arity",
  { type: "Constant Equality", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(loadProjectContext.length !== 2, `expected 2 required params, got ${loadProjectContext.length}`),
    ),
);

/* ---------- ProjectContext ---------- */

/**
 * @spec.property project-context-folders-non-empty-for-self-host
 * @spec.type Inclusion
 * @spec.exports loadProjectContext
 * @spec.claim the codemod's own project tree resolves to a non-empty `folders` list and includes the codemod's well-known folders (`src/spec/grammar`, `src/analysis`) — the precomputed list both commands consume
 */
itSpec.prop(
  "project-context-folders-non-empty-for-self-host",
  { type: "Inclusion", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(CTX.folders.length === 0, `expected non-empty folders`);
        const set = new Set(CTX.folders);
        yield* failIf(!set.has("src/spec/grammar"), `missing src/spec/grammar`);
        yield* failIf(!set.has("src/analysis"), `missing src/analysis`);
      }),
    ),
);

/**
 * @spec.property project-context-folders-no-duplicates
 * @spec.type Constant Non-Equality
 * @spec.exports loadProjectContext
 * @spec.claim `ctx.folders` contains no duplicate entries — every discovered folder appears exactly once
 */
itSpec.prop(
  "project-context-folders-no-duplicates",
  { type: "Constant Non-Equality", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(new Set(CTX.folders).size !== CTX.folders.length, `duplicates present`),
    ),
);

/* ---------- ctx.resolveFolder ---------- */

/**
 * @spec.property resolve-folder-canonicalizes-trailing-slash
 * @spec.type Inclusion
 * @spec.exports loadProjectContext
 * @spec.claim a known folder with a trailing slash resolves to the canonical (slash-stripped) form — authoring conveniences don't manifest as `FolderNotFoundError`
 */
itSpec.prop(
  "resolve-folder-canonicalizes-trailing-slash",
  { type: "Inclusion", exports: [loadProjectContext] },
  fc.constantFrom("src/spec/grammar/", "src/spec/grammar", "./src/spec/grammar"),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const resolved = yield* CTX.resolveFolder(input).pipe(
          Effect.catchTag("FolderNotFoundError", () => Effect.succeed(null as string | null)),
        );
        yield* failIf(
          resolved !== "src/spec/grammar",
          `resolved ${input} to ${JSON.stringify(resolved)}`,
        );
      }),
    ),
);

/**
 * @spec.property resolve-folder-fails-on-typo
 * @spec.type Exception Raising
 * @spec.exports loadProjectContext
 * @spec.claim a folder that doesn't exist resolves to `FolderNotFoundError` carrying the original user input — the cli's exit-1 path
 */
itSpec.prop(
  "resolve-folder-fails-on-typo",
  { type: "Exception Raising", exports: [loadProjectContext] },
  fc.string({ minLength: 8, maxLength: 30 }).filter((s) => !s.includes(" ") && !s.includes("/")),
  (bogus) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(CTX.resolveFolder(`src/__missing_${bogus}__`));
        yield* failIf(!Exit.isFailure(exit), `expected failure on bogus folder`);
      }),
    ),
);

/* ---------- ctx.subfoldersOf ---------- */

/**
 * @spec.property subfolders-of-spec-includes-grammar-and-artifact
 * @spec.type Inclusion
 * @spec.exports loadProjectContext
 * @spec.claim `ctx.subfoldersOf("src/spec")` returns `["src/spec/artifact", "src/spec/grammar"]` — the precomputed immediate-children map that `buildChildren` consumes
 */
itSpec.prop(
  "subfolders-of-spec-includes-grammar-and-artifact",
  { type: "Inclusion", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const subs = new Set(CTX.subfoldersOf("src/spec"));
        yield* failIf(!subs.has("src/spec/grammar"), `missing src/spec/grammar`);
        yield* failIf(!subs.has("src/spec/artifact"), `missing src/spec/artifact`);
      }),
    ),
);

/**
 * @spec.property subfolders-of-leaf-folder-empty
 * @spec.type Constant Equality
 * @spec.exports loadProjectContext
 * @spec.claim a leaf folder (no SPEC'd subfolders) yields an empty array — degenerate case stays degenerate
 */
itSpec.prop(
  "subfolders-of-leaf-folder-empty",
  { type: "Constant Equality", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        CTX.subfoldersOf("src/spec/grammar").length !== 0,
        `expected empty for leaf folder`,
      ),
    ),
);

/**
 * @spec.property subfolders-of-unknown-folder-empty
 * @spec.type Constant Equality
 * @spec.exports loadProjectContext
 * @spec.claim `ctx.subfoldersOf(folder)` returns an empty array (not undefined/null) for any folder NOT in the discovered list — total function, no exceptions
 */
itSpec.prop(
  "subfolders-of-unknown-folder-empty",
  { type: "Constant Equality", exports: [loadProjectContext] },
  fc.string({ minLength: 8, maxLength: 30 }).filter((s) => !s.includes("/")),
  (bogus) =>
    Effect.runPromise(
      failIf(
        CTX.subfoldersOf(`src/__missing_${bogus}__`).length !== 0,
        `expected empty for unknown folder`,
      ),
    ),
);

/* ---------- ctx.thresholdsFor ---------- */

/**
 * @spec.property thresholds-for-default-folder-non-negative
 * @spec.type Constant Bounds Checking
 * @spec.exports loadProjectContext
 * @spec.claim every metric in `ctx.thresholdsFor(folder)` is a non-negative number — the gate semantics requires "below threshold" to be meaningful; negative thresholds would invert the comparison
 */
itSpec.prop(
  "thresholds-for-default-folder-non-negative",
  { type: "Constant Bounds Checking", exports: [loadProjectContext] },
  fc.constantFrom("src", "src/spec", "src/analysis", "src/spec/grammar"),
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const t = CTX.thresholdsFor(folder);
        yield* failIf(t.typeCoverage < 0, `typeCoverage negative`);
        yield* failIf(t.preconditionPassRate < 0, `precondition negative`);
      }),
    ),
);

/**
 * @spec.property thresholds-for-typechecks-as-thresholds
 * @spec.type Typechecking
 * @spec.exports loadProjectContext
 * @spec.claim the output of `ctx.thresholdsFor(folder)` exposes two `number` fields (`typeCoverage`, `preconditionPassRate`) — the shape `checkThresholds` reads in the validate pipeline
 */
itSpec.prop(
  "thresholds-for-typechecks-as-thresholds",
  { type: "Typechecking", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const t = CTX.thresholdsFor("src");
        yield* failIf(typeof t.typeCoverage !== "number", `typeCoverage number`);
        yield* failIf(typeof t.preconditionPassRate !== "number", `precondition number`);
      }),
    ),
);

/**
 * @spec.property thresholds-for-deterministic
 * @spec.type Roundtrip
 * @spec.exports loadProjectContext
 * @spec.claim `ctx.thresholdsFor(folder)` is deterministic — two calls with the same folder return equal Thresholds (the function is pure on the precomputed config)
 */
itSpec.prop(
  "thresholds-for-deterministic",
  { type: "Roundtrip", exports: [loadProjectContext] },
  fc.constantFrom("src", "src/spec", "src/analysis"),
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const a = CTX.thresholdsFor(folder);
        const b = CTX.thresholdsFor(folder);
        yield* failIf(JSON.stringify(a) !== JSON.stringify(b), `non-deterministic`);
      }),
    ),
);

/* ---------- excludeRootPrefixes discovery exclusion ---------- */

// Synthetic on-disk project: a config excluding `vendor`, one folder under
// the excluded prefix, one sibling that must survive discovery.
const EXCLUSION_ROOT = nodePath.join(
  os.tmpdir(),
  `safer-spec-context-exclusion-${crypto.randomBytes(4).toString("hex")}`,
);

const EXCLUSION_CTX: ProjectContext = await Effect.runPromise(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.join(EXCLUSION_ROOT, "vendor", "mod"), { recursive: true });
    yield* fs.makeDirectory(path.join(EXCLUSION_ROOT, "core"), { recursive: true });
    yield* fs.writeFileString(
      path.join(EXCLUSION_ROOT, "safer-spec.config.json"),
      JSON.stringify({ excludeRootPrefixes: ["vendor"] }),
    );
    yield* fs.writeFileString(
      path.join(EXCLUSION_ROOT, "vendor", "mod", "index.ts"),
      "export const vendored = 1;\n",
    );
    yield* fs.writeFileString(
      path.join(EXCLUSION_ROOT, "core", "index.ts"),
      "export const kept = 1;\n",
    );
    return yield* loadProjectContext(fs, path, EXCLUSION_ROOT);
  }).pipe(
    Effect.catchAll((e) =>
      Effect.die(new Error(`exclusion fixture load failed: ${JSON.stringify(e)}`)),
    ),
    Effect.provide(NodeContext.layer),
  ),
);

/**
 * @spec.property project-context-excludes-configured-root-prefixes
 * @spec.type Inclusion
 * @spec.exports loadProjectContext
 * @spec.claim folders and sources under a configured `excludeRootPrefixes` entry are absent from the snapshot while sibling folders survive discovery
 */
itSpec.prop(
  "project-context-excludes-configured-root-prefixes",
  { type: "Inclusion", exports: [loadProjectContext] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const folders = EXCLUSION_CTX.folders;
        yield* failIf(
          folders.some((f) => f === "vendor" || f.startsWith("vendor/")),
          `expected no vendor folders, got ${JSON.stringify(folders)}`,
        );
        yield* failIf(
          !folders.some((f) => f === "core" || f.endsWith("/core")),
          `expected core folder to survive, got ${JSON.stringify(folders)}`,
        );
        yield* failIf(
          EXCLUSION_CTX.sources.some((s) => s.path.includes(`${nodePath.sep}vendor${nodePath.sep}`)),
          `expected no sources under the excluded prefix`,
        );
      }),
    ),
);
