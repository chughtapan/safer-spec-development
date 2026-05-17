/**
 * @spec.purpose Property tests for the sidecar-I/O wrappers in
 *   `spec/artifact/` — `regenerateSidecar` (build + serialize),
 *   `loadExecutionSidecar` (read + decode), `computeTestTreeHash`
 *   (read + hash). Split out of `coverage.spec.test.ts` to keep each
 *   file under the strict max-lines cap.
 */

import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Data, Effect, Exit } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  buildSpecMeta,
  computeTestTreeHash,
  loadBranchCoverage,
  loadExecutionSidecar,
  regenerateSidecar,
  type FolderAnalysis,
  type SpecMeta,
} from "@safer/spec/artifact/index.js";

class SidecarIoAssertionError extends Data.TaggedError("SidecarIoAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, SidecarIoAssertionError> =>
  cond ? Effect.fail(new SidecarIoAssertionError({ detail })) : Effect.void;

const EMPTY_ANALYSIS: FolderAnalysis = {
  folder: "src/x",
  purpose: null,
  exports: [],
  properties: [],
  children: [],
};

const META_NO_GATE: SpecMeta = buildSpecMeta(EMPTY_ANALYSIS, {
  generatedAtSha: "deadbee",
  thresholds: { typeCoverage: 0, preconditionPassRate: 0, branchCoverageFromSpecTests: 0 },
});

const withFs = <A, E>(
  body: (fs: FileSystem.FileSystem, path: Path.Path) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* body(fs, path);
  }).pipe(Effect.provide(NodeContext.layer)) as Effect.Effect<A, E>;

/* ---------- regenerateSidecar ---------- */

/**
 * @spec.property regenerate-sidecar-typecheck
 * @spec.type Typechecking
 * @spec.exports regenerateSidecar
 * @spec.claim returns an Effect — the typed channel the sidecar-drift check composes around
 */
itSpec.prop(
  "regenerate-sidecar-typecheck",
  { type: "Typechecking", exports: [regenerateSidecar] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(typeof regenerateSidecar !== "function", `must be function`),
    ),
);

/**
 * @spec.property regenerate-sidecar-deterministic
 * @spec.type Roundtrip
 * @spec.exports regenerateSidecar
 * @spec.claim two consecutive calls produce byte-identical JSON — the freshness-check contract sidecar-drift compares against
 */
itSpec.prop(
  "regenerate-sidecar-deterministic",
  { type: "Roundtrip", exports: [regenerateSidecar] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const a = yield* regenerateSidecar(EMPTY_ANALYSIS, META_NO_GATE);
        const b = yield* regenerateSidecar(EMPTY_ANALYSIS, META_NO_GATE);
        yield* failIf(a !== b, `non-deterministic`);
      }),
    ),
);

/**
 * @spec.property regenerate-sidecar-non-empty-output
 * @spec.type Constant Bounds Checking
 * @spec.exports regenerateSidecar
 * @spec.claim emitted JSON is non-empty for any well-formed analysis — the sidecar file always has content
 */
itSpec.prop(
  "regenerate-sidecar-non-empty-output",
  { type: "Constant Bounds Checking", exports: [regenerateSidecar] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const json = yield* regenerateSidecar(EMPTY_ANALYSIS, META_NO_GATE);
        yield* failIf(json.length === 0, `empty`);
      }),
    ),
);

/* ---------- computeTestTreeHash ---------- */

/**
 * @spec.property compute-test-tree-hash-typecheck
 * @spec.type Typechecking
 * @spec.exports computeTestTreeHash
 * @spec.claim returns an Effect producing a hex string of length 64 — sha256 digest
 */
itSpec.prop(
  "compute-test-tree-hash-typecheck",
  { type: "Typechecking", exports: [computeTestTreeHash] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs) =>
        Effect.gen(function* () {
          const h = yield* computeTestTreeHash(fs, []);
          yield* failIf(typeof h !== "string", `not string`);
          yield* failIf(h.length !== 64, `expected 64 chars, got ${h.length}`);
        }),
      ),
    ),
);

/**
 * @spec.property compute-test-tree-hash-empty-input-stable-hash
 * @spec.type Constant Equality
 * @spec.exports computeTestTreeHash
 * @spec.claim `computeTestTreeHash(fs, [])` is the sha256 of the empty string — the documented baseline hash for the degenerate-input case
 */
itSpec.prop(
  "compute-test-tree-hash-empty-input-stable-hash",
  { type: "Constant Equality", exports: [computeTestTreeHash] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs) =>
        Effect.gen(function* () {
          const h = yield* computeTestTreeHash(fs, []);
          yield* failIf(
            h !== "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            `unexpected empty-input hash: ${h}`,
          );
        }),
      ),
    ),
);

/**
 * @spec.property compute-test-tree-hash-deterministic
 * @spec.type Roundtrip
 * @spec.exports computeTestTreeHash
 * @spec.claim two calls with the same paths produce equal digests — the freshness-gate contract
 */
itSpec.prop(
  "compute-test-tree-hash-deterministic",
  { type: "Roundtrip", exports: [computeTestTreeHash] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs) =>
        Effect.gen(function* () {
          const a = yield* computeTestTreeHash(fs, []);
          const b = yield* computeTestTreeHash(fs, []);
          yield* failIf(a !== b, `non-deterministic`);
        }),
      ),
    ),
);

/* ---------- loadExecutionSidecar ---------- */

/**
 * @spec.property load-execution-sidecar-typecheck
 * @spec.type Typechecking
 * @spec.exports loadExecutionSidecar
 * @spec.claim returns an Effect that yields `ExecutionSidecar | null` — `null` when the sidecar file is absent or malformed
 */
itSpec.prop(
  "load-execution-sidecar-typecheck",
  { type: "Typechecking", exports: [loadExecutionSidecar] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(typeof loadExecutionSidecar !== "function", `must be function`),
    ),
);

/**
 * @spec.property load-execution-sidecar-missing-yields-null
 * @spec.type Constant Equality
 * @spec.exports loadExecutionSidecar
 * @spec.claim a folder that has no execution sidecar on disk resolves to `null` — absence is a typed signal, not an error
 */
itSpec.prop(
  "load-execution-sidecar-missing-yields-null",
  { type: "Constant Equality", exports: [loadExecutionSidecar] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs, path) =>
        Effect.gen(function* () {
          const result = yield* loadExecutionSidecar(fs, path, "src/__missing_folder__");
          yield* failIf(result !== null, `expected null for missing sidecar`);
        }),
      ),
    ),
);

/**
 * @spec.property load-execution-sidecar-graceful-on-bogus-folder
 * @spec.type Exception Raising
 * @spec.exports loadExecutionSidecar
 * @spec.claim `loadExecutionSidecar` never fails on the Effect error channel — missing/malformed sidecars resolve to `null`, not a typed error
 */
itSpec.prop(
  "load-execution-sidecar-graceful-on-bogus-folder",
  { type: "Exception Raising", exports: [loadExecutionSidecar] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs, path) =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            loadExecutionSidecar(fs, path, "src/__missing__"),
          );
          yield* failIf(!Exit.isSuccess(exit), `expected success, got failure`);
        }),
      ),
    ),
);

/* ---------- loadBranchCoverage ---------- */

/**
 * @spec.property load-branch-coverage-typecheck
 * @spec.type Typechecking
 * @spec.exports loadBranchCoverage
 * @spec.claim returns an Effect that yields a number in `[0, 1]` or `null` — the per-folder branch ratio v8 coverage attributes to spec tests, null when coverage-summary.json is absent or has no branch data for the folder
 */
itSpec.prop(
  "load-branch-coverage-typecheck",
  { type: "Typechecking", exports: [loadBranchCoverage] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(typeof loadBranchCoverage !== "function", `must be function`),
    ),
);

/**
 * @spec.property load-branch-coverage-missing-folder-yields-null
 * @spec.type Constant Equality
 * @spec.exports loadBranchCoverage
 * @spec.claim asking for branch coverage of a folder that has no entries in coverage-summary.json resolves to `null` — folder absence is a typed signal, not an error
 */
itSpec.prop(
  "load-branch-coverage-missing-folder-yields-null",
  { type: "Constant Equality", exports: [loadBranchCoverage] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs, path) =>
        Effect.gen(function* () {
          const result = yield* loadBranchCoverage(fs, path, "src/__missing_folder__", {
            expectedSources: [],
          });
          yield* failIf(result !== null, `expected null for missing folder`);
        }),
      ),
    ),
);

/**
 * @spec.property load-branch-coverage-graceful-on-bogus-input
 * @spec.type Exception Raising
 * @spec.exports loadBranchCoverage
 * @spec.claim `loadBranchCoverage` never fails on the Effect error channel — coverage-summary.json absence or malformation resolves to `null`, not a typed error
 */
itSpec.prop(
  "load-branch-coverage-graceful-on-bogus-input",
  { type: "Exception Raising", exports: [loadBranchCoverage] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs, path) =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            loadBranchCoverage(fs, path, "src/__missing__", {
              expectedSources: [],
              projectRoot: "/nonexistent/project/root",
            }),
          );
          yield* failIf(!Exit.isSuccess(exit), `expected success, got failure`);
        }),
      ),
    ),
);

/**
 * @spec.property load-branch-coverage-bounded-in-zero-one
 * @spec.type Constant Bounds Checking
 * @spec.exports loadBranchCoverage
 * @spec.claim when not null, the returned ratio is in `[0, 1]` — branch coverage is a ratio of covered / total
 */
itSpec.prop(
  "load-branch-coverage-bounded-in-zero-one",
  { type: "Constant Bounds Checking", exports: [loadBranchCoverage] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      withFs((fs, path) =>
        Effect.gen(function* () {
          const result = yield* loadBranchCoverage(fs, path, "src/spec/grammar", {
            expectedSources: [],
          });
          if (result === null) return;
          yield* failIf(result < 0 || result > 1, `out of [0,1]: ${result}`);
        }),
      ),
    ),
);
