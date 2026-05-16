/**
 * @spec.purpose Property tests for `project/`'s three tagged error
 *   classes — `ProjectContextError` (tsconfig/git/source-walk failures),
 *   `ConfigError` (`safer-spec.config.json` decode failures), and
 *   `FolderNotFoundError` (`--folder X` doesn't match a discovered
 *   folder). Plus `SPEC_FORMAT_VERSION` property types.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  ConfigError,
  FolderNotFoundError,
  ProjectContextError,
  SPEC_FORMAT_VERSION,
} from "@safer/project/index.js";

class ProjErrAssertionError extends Data.TaggedError("ProjErrAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, ProjErrAssertionError> =>
  cond ? Effect.fail(new ProjErrAssertionError({ detail })) : Effect.void;

/* ---------- ProjectContextError ---------- */

/**
 * @spec.property project-context-error-roundtrips-payload
 * @spec.type Roundtrip
 * @spec.exports ProjectContextError
 * @spec.claim a `ProjectContextError` exposes the `{path, cause}` payload it was constructed with — the surface the runtime exit-formatter reads when tsconfig load fails
 */
itSpec.prop(
  "project-context-error-roundtrips-payload",
  { type: "Roundtrip", exports: [ProjectContextError] },
  fc.record({
    path: fc.string({ minLength: 1, maxLength: 40 }),
    cause: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  ({ path, cause }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new ProjectContextError({ path, cause });
        yield* failIf(e.path !== path, `path roundtrip`);
        yield* failIf(e.cause !== cause, `cause roundtrip`);
        yield* failIf(e._tag !== "ProjectContextError", `tag`);
      }),
    ),
);

/**
 * @spec.property project-context-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports ProjectContextError
 * @spec.claim `ProjectContextError` round-trips through `Effect.fail` / `Effect.catchTag` without payload loss — the surface load-time loaders route their failures through
 */
itSpec.prop(
  "project-context-error-is-throwable",
  { type: "Exception Raising", exports: [ProjectContextError] },
  fc.string({ minLength: 1, maxLength: 50 }),
  (cause) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(
          new ProjectContextError({ path: "tsconfig.json", cause }),
        ).pipe(Effect.catchTag("ProjectContextError", (e) => Effect.succeed(e.cause)));
        yield* failIf(caught !== cause, `catchTag roundtrip`);
      }),
    ),
);

/**
 * @spec.property project-context-error-typecheck
 * @spec.type Typechecking
 * @spec.exports ProjectContextError
 * @spec.claim instances of `ProjectContextError` extend `Error` and carry `_tag`, `path`, `cause` strings — the runtime shape Effect's exit-cause renderer expects
 */
itSpec.prop(
  "project-context-error-typecheck",
  { type: "Typechecking", exports: [ProjectContextError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new ProjectContextError({ path: "x", cause: "y" });
        yield* failIf(!(e instanceof Error), `must extend Error`);
        yield* failIf(typeof e._tag !== "string", `_tag must be string`);
        yield* failIf(typeof e.path !== "string", `path must be string`);
        yield* failIf(typeof e.cause !== "string", `cause must be string`);
      }),
    ),
);

/* ---------- ConfigError ---------- */

/**
 * @spec.property config-error-roundtrips-payload
 * @spec.type Roundtrip
 * @spec.exports ConfigError
 * @spec.claim a `ConfigError` exposes the `{path, cause}` payload it was constructed with — the surface load-time decoders raise on malformed config
 */
itSpec.prop(
  "config-error-roundtrips-payload",
  { type: "Roundtrip", exports: [ConfigError] },
  fc.record({
    path: fc.string({ minLength: 1, maxLength: 40 }),
    cause: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  ({ path, cause }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new ConfigError({ path, cause });
        yield* failIf(e.path !== path, `path roundtrip`);
        yield* failIf(e.cause !== cause, `cause roundtrip`);
        yield* failIf(e._tag !== "ConfigError", `tag`);
      }),
    ),
);

/**
 * @spec.property config-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports ConfigError
 * @spec.claim `ConfigError` round-trips through `Effect.fail` / `Effect.catchTag` — the surface `loadConfig` raises on a malformed `safer-spec.config.json`
 */
itSpec.prop(
  "config-error-is-throwable",
  { type: "Exception Raising", exports: [ConfigError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(
          new ConfigError({ path: "safer-spec.config.json", cause: "bad key" }),
        ).pipe(Effect.catchTag("ConfigError", (e) => Effect.succeed(e.path)));
        yield* failIf(caught !== "safer-spec.config.json", `catchTag roundtrip`);
      }),
    ),
);

/**
 * @spec.property config-error-typecheck
 * @spec.type Typechecking
 * @spec.exports ConfigError
 * @spec.claim `ConfigError` instances expose `_tag` (string), `path` (string), and `cause` (string) — the shape consumed by the CLI stderr renderer
 */
itSpec.prop(
  "config-error-typecheck",
  { type: "Typechecking", exports: [ConfigError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new ConfigError({ path: "x", cause: "y" });
        yield* failIf(!(e instanceof Error), `must extend Error`);
        yield* failIf(typeof e.path !== "string", `path type`);
        yield* failIf(typeof e.cause !== "string", `cause type`);
      }),
    ),
);

/* ---------- FolderNotFoundError ---------- */

/**
 * @spec.property folder-not-found-error-roundtrips-payload
 * @spec.type Roundtrip
 * @spec.exports FolderNotFoundError
 * @spec.claim `FolderNotFoundError` exposes the `{requested}` payload it was constructed with — the cli's stderr message echoes the user's input back so they can spot typos
 */
itSpec.prop(
  "folder-not-found-error-roundtrips-payload",
  { type: "Roundtrip", exports: [FolderNotFoundError] },
  fc.string({ minLength: 1, maxLength: 40 }),
  (requested) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new FolderNotFoundError({ requested });
        yield* failIf(e.requested !== requested, `requested roundtrip`);
        yield* failIf(e._tag !== "FolderNotFoundError", `tag`);
      }),
    ),
);

/**
 * @spec.property folder-not-found-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports FolderNotFoundError
 * @spec.claim `FolderNotFoundError` round-trips through `Effect.fail` / `Effect.catchTag` — the cli's exit-1 path for unresolved `--folder` arguments
 */
itSpec.prop(
  "folder-not-found-error-is-throwable",
  { type: "Exception Raising", exports: [FolderNotFoundError] },
  fc.string({ minLength: 1, maxLength: 30 }),
  (requested) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(
          new FolderNotFoundError({ requested }),
        ).pipe(Effect.catchTag("FolderNotFoundError", (e) => Effect.succeed(e.requested)));
        yield* failIf(caught !== requested, `catchTag roundtrip`);
      }),
    ),
);

/**
 * @spec.property folder-not-found-error-typecheck
 * @spec.type Typechecking
 * @spec.exports FolderNotFoundError
 * @spec.claim `FolderNotFoundError` instances extend `Error` and expose `_tag === "FolderNotFoundError"` plus a `requested` string
 */
itSpec.prop(
  "folder-not-found-error-typecheck",
  { type: "Typechecking", exports: [FolderNotFoundError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new FolderNotFoundError({ requested: "src/missing" });
        yield* failIf(!(e instanceof Error), `must extend Error`);
        yield* failIf(e._tag !== "FolderNotFoundError", `tag`);
        yield* failIf(typeof e.requested !== "string", `requested string`);
      }),
    ),
);

/* ---------- SPEC_FORMAT_VERSION ---------- */

/**
 * @spec.property spec-format-version-non-empty-constant
 * @spec.type Constant Equality
 * @spec.exports SPEC_FORMAT_VERSION
 * @spec.claim `SPEC_FORMAT_VERSION === "0.1.0"` — the literal version stamp every SPEC.md frontmatter and sidecar JSON carries; the migrate skill keys committed artifacts on bumps of this string
 */
itSpec.prop(
  "spec-format-version-non-empty-constant",
  { type: "Constant Equality", exports: [SPEC_FORMAT_VERSION] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(SPEC_FORMAT_VERSION !== "0.1.0", `expected "0.1.0", got ${SPEC_FORMAT_VERSION}`),
    ),
);

/**
 * @spec.property spec-format-version-bounded-length
 * @spec.type Constant Bounds Checking
 * @spec.exports SPEC_FORMAT_VERSION
 * @spec.claim `SPEC_FORMAT_VERSION` length stays under 32 chars — keeps the frontmatter YAML compact and the sidecar JSON readable in narrow editor panes
 */
itSpec.prop(
  "spec-format-version-bounded-length",
  { type: "Constant Bounds Checking", exports: [SPEC_FORMAT_VERSION] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        SPEC_FORMAT_VERSION.length === 0 || SPEC_FORMAT_VERSION.length > 32,
        `out of bounds length: ${SPEC_FORMAT_VERSION.length}`,
      ),
    ),
);

/**
 * @spec.property spec-format-version-typechecks-as-string
 * @spec.type Typechecking
 * @spec.exports SPEC_FORMAT_VERSION
 * @spec.claim `SPEC_FORMAT_VERSION` is a non-empty string — the stable label every emitted SPEC.md frontmatter and sidecar JSON stamps
 */
itSpec.prop(
  "spec-format-version-typechecks-as-string",
  { type: "Typechecking", exports: [SPEC_FORMAT_VERSION] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(typeof SPEC_FORMAT_VERSION !== "string", `must be string`);
        yield* failIf(SPEC_FORMAT_VERSION.length === 0, `must be non-empty`);
      }),
    ),
);

/**
 * @spec.property spec-format-version-includes-dot-separator
 * @spec.type Inclusion
 * @spec.exports SPEC_FORMAT_VERSION
 * @spec.claim the format version string contains a `.` separator — the stable signal `migrate` keys off of for parsing the major/minor version
 */
itSpec.prop(
  "spec-format-version-includes-dot-separator",
  { type: "Inclusion", exports: [SPEC_FORMAT_VERSION] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(!SPEC_FORMAT_VERSION.includes("."), `no dot: ${SPEC_FORMAT_VERSION}`),
    ),
);
