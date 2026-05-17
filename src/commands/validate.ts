/**
 * @spec.purpose `validate` command entrypoint. Walks each folder under
 *   cwd (or a single folder under `--folder X`), calls
 *   `analysis.validateFolder` per folder, and maps the first
 *   `ValidateGapError` to a POSIX exit code at the cli boundary.
 *   Per-folder pipeline orchestration lives entirely in `@safer/analysis/`;
 *   this file owns folder discovery, project-context loading, and the
 *   stderr diagnostic formatter.
 *
 *   `--planned`: regenerate SPEC.md + sidecar, diff on-disk; enforce
 *   per-folder coverage thresholds; per-test directive completeness is
 *   enforced via `extractProperties` issues + the diff check.
 *
 *   `--implemented`: planned-mode checks plus every `itSpec.prop` body is
 *   non-empty (no `itSpec.todo` placeholder).
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect, Option } from "effect";
import {
  FolderNotFoundError,
  loadProjectContext,
  type ProjectContext,
} from "@safer/project/index.js";
import {
  computeProjectNewestMtime,
  diagnosticLines,
  validateFolder,
  type ValidateGapError,
} from "@safer/analysis/index.js";

export type { ValidateGapError } from "@safer/analysis/index.js";

/**
 * Tag-to-POSIX exit code mapping for the gap-class errors. The
 * `satisfies` clause guarantees every `ValidateGapError["_tag"]` is mapped at
 * compile time.
 */
export const VALIDATE_GAP_EXIT_CODES = {
  MissingSpecPropertyError: 11,
  MissingStubError: 12,
  MissingImplError: 13,
} as const satisfies Record<ValidateGapError["_tag"], number>;

export const FOLDER_NOT_FOUND_EXIT_CODE = 1;

interface ValidateInput {
  readonly folder: Option.Option<string>;
  readonly mode: "planned" | "implemented";
}

interface ValidatePassReport {
  readonly _tag: "pass";
  readonly foldersValidated: ReadonlyArray<string>;
}

const resolveFolders = (
  input: ValidateInput,
  ctx: ProjectContext,
): Effect.Effect<ReadonlyArray<string>, FolderNotFoundError> =>
  Option.isSome(input.folder)
    ? ctx.resolveFolder(input.folder.value).pipe(Effect.map((f) => [f]))
    : Effect.succeed(ctx.folders);

const loadProjectCtxOrDie = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<ProjectContext, never> =>
  loadProjectContext(fs, path).pipe(
    Effect.catchTag("ProjectContextError", (e) =>
      Effect.die(new Error(`failed to load project context: ${e.cause}`)),
    ),
    Effect.catchTag("ConfigError", (e) =>
      Effect.die(
        new Error(`safer-spec.config.json at ${e.path} is invalid: ${e.cause}`),
      ),
    ),
  );

/**
 * @spec.assume "`analysis.generateFolder` is deterministic at the same tree SHA"
 *   reason: drift cross-checks (inside validateFolder) rely on byte-equality
 *           between on-disk and regenerated artifacts.
 * @spec.guarantee "first failing folder short-circuits with exactly one of the four gap-class errors; the cli's catchTags routing maps the tag to a POSIX exit code"
 *   reason: contract for commands/index.ts.
 * @spec.residual-contract "Vitest reporter sidecars must already exist on disk for `--implemented` mode; their absence is reported as MissingImplError"
 *   reason: lifecycle ordering; not encoded in the input shape.
 */
export const validate = (
  input: ValidateInput,
): Effect.Effect<
  ValidatePassReport,
  ValidateGapError | FolderNotFoundError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const projectCtx = yield* loadProjectCtxOrDie(fs, path);
    const folders = yield* resolveFolders(input, projectCtx);
    const folderArgsBase = yield* buildFolderArgsBase(fs, path, projectCtx, input.mode);
    const validated: string[] = [];
    for (const folder of folders) {
      const result = yield* validateFolder({ ...folderArgsBase, folder });
      if (result !== null) validated.push(result);
    }
    if (validated.length === 0) {
      const requested = Option.isSome(input.folder)
        ? input.folder.value
        : "<no index.ts folders discovered>";
      return yield* Effect.fail(new FolderNotFoundError({ requested }));
    }
    return { _tag: "pass" as const, foldersValidated: validated };
  }).pipe(Effect.withSpan("commands/validate"));

// coverage-summary.json is a project-wide aggregate, so an edit
// anywhere in the spec-test tree can invalidate any folder's branch
// numbers. Compute the project-wide newest mtime once and pass it
// to each validateFolder call as the freshness reference.
const buildFolderArgsBase = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  projectCtx: ProjectContext,
  mode: "planned" | "implemented",
): Effect.Effect<
  {
    readonly fs: FileSystem.FileSystem;
    readonly path: Path.Path;
    readonly projectCtx: ProjectContext;
    readonly mode: "planned" | "implemented";
    readonly projectNewestMtime?: number;
  },
  never
> =>
  Effect.gen(function* () {
    const base = { fs, path, projectCtx, mode };
    if (mode !== "implemented") return base;
    const projectNewestMtime = yield* computeProjectNewestMtime(fs, path, projectCtx);
    return { ...base, projectNewestMtime };
  });

/**
 * @spec.guarantee "output string is the canonical user-facing diagnostic body for the given gap-class error"
 *   reason: the CLI binary writes this directly to stderr; no further
 *           shaping happens at the runtime boundary.
 * @spec.residual-contract none
 *   reason: pure transformation; output shape derived from input.
 */
export const formatDiagnostic = (
  err: ValidateGapError,
): Effect.Effect<string, never> =>
  Effect.sync(() =>
    diagnosticLines(err._tag, {
      location: err.location,
      diagnostic: err.diagnostic,
    }).join("\n"),
  );
