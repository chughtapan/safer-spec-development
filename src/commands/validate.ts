/**
 * @spec.purpose
 *   `validate` command entrypoint. Walks each folder that has an `index.ts`
 *   barrel, runs the same analysis pipeline as `generate`, diffs the
 *   regenerated SPEC.md + sidecar against the on-disk artifacts, enforces
 *   coverage thresholds, and reports gap-class failures via tagged errors
 *   mapped to POSIX exit codes {1, 11, 12, 13}.
 *
 *   `commands/index.ts` translates each tag at the runtime boundary. The
 *   per-check effects and their tagged errors live in
 *   `commands/validate-checks.ts`; the shared analysis pipeline (folder
 *   walking, directive parsing, sidecar regeneration, threshold lookup)
 *   lives in `commands/validate-pipeline.ts`. This file is orchestration
 *   only.
 *
 *   `--planned`: regenerate SPEC.md + sidecar, diff on-disk; enforce
 *   per-folder coverage thresholds; per-test directive completeness is
 *   enforced via `extractProperties` issues + the diff check.
 *
 *   `--implemented`: planned-mode checks plus every `itSpec.prop` body is
 *   non-empty (no `itSpec.todo` placeholder).
 *
 *   Diagnostics carry a problem / cause / fix / docsLink quartet so agents
 *   can route the next remediation step.
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect, Option } from "effect";
import { normalizeFolder } from "@safer/commands/project-context.js";
import {
  buildSpecMeta,
  collectFolderInputs,
  discoverFolders,
  inspectFolder,
  loadValidateProjectContext,
  regenerateMarkdown,
  regenerateSidecar,
  sidecarSlug,
  type FolderInputs,
  type ProjectContext,
} from "@safer/commands/validate-pipeline.js";
import {
  catchDirectiveErrors,
  checkDrift,
  checkImplBodies,
  checkSidecarDrift,
  checkThresholds,
  diagnosticLines,
  failOnIssues,
  unresolvedFolderError,
  type ValidateGapError,
} from "@safer/commands/validate-checks.js";

export type { ValidateGapError } from "@safer/commands/validate-checks.js";

/**
 * Tag-to-POSIX exit code mapping for the gap-class errors. The
 * `satisfies` clause guarantees every `ValidateGapError["_tag"]` is mapped at
 * compile time.
 */
export const VALIDATE_GAP_EXIT_CODES = {
  MissingSpecPropertyError: 11,
  MissingStubError: 12,
  MissingImplError: 13,
  NoFoldersResolvedError: 1,
} as const satisfies Record<ValidateGapError["_tag"], number>;

interface ValidateInput {
  readonly folder: Option.Option<string>;
  readonly mode: "planned" | "implemented";
  readonly formatVersionCheck: boolean;
}

interface ValidatePassReport {
  readonly _tag: "pass";
  readonly foldersValidated: ReadonlyArray<string>;
}

interface ValidateCtx {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly mode: "planned" | "implemented";
  readonly projectCtx: ProjectContext;
}

const validateOneFolder = (
  ctx: ValidateCtx,
  folder: string,
  inputs: FolderInputs,
): Effect.Effect<string, ValidateGapError> =>
  Effect.gen(function* () {
    const inspection = yield* catchDirectiveErrors(
      inspectFolder({ fs: ctx.fs, path: ctx.path, folder, inputs, ctx: ctx.projectCtx }),
    );
    yield* failOnIssues(inspection.issues, ctx.mode);
    const meta = buildSpecMeta(inspection.analysis, ctx.projectCtx);
    const regenerated = regenerateMarkdown(inspection.analysis, meta);
    yield* checkDrift(ctx.fs, ctx.path.join(folder, "SPEC.md"), regenerated);
    const sidecarJson = yield* regenerateSidecar(inspection.analysis, meta);
    const sidecarPath = ctx.path.join(
      folder,
      ".safer-spec",
      `${sidecarSlug(folder)}.json`,
    );
    yield* checkSidecarDrift(ctx.fs, sidecarPath, sidecarJson);
    yield* checkThresholds(folder, inspection.analysis, meta);
    if (ctx.mode === "implemented") yield* checkImplBodies(inspection.analysis);
    return folder;
  });

const validateFolders = (
  ctx: ValidateCtx,
  folders: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, ValidateGapError> =>
  Effect.gen(function* () {
    const out: string[] = [];
    for (const folder of folders) {
      const inputs = yield* collectFolderInputs(ctx.fs, ctx.path, folder);
      if (inputs === null) continue;
      out.push(yield* validateOneFolder(ctx, folder, inputs));
    }
    return out;
  });

const resolveFolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  input: ValidateInput,
): Effect.Effect<ReadonlyArray<string>, never> =>
  Option.isSome(input.folder)
    ? Effect.succeed([normalizeFolder(input.folder.value)])
    : discoverFolders(fs, path, ".");

/**
 * @spec.assume "the underlying `generate` step is deterministic at the same tree SHA"
 *   reason: drift cross-checks rely on byte-equality between on-disk and
 *           regenerated artifacts (SPEC.md + sidecar JSON).
 * @spec.guarantee "first failing check short-circuits and emits exactly one of the four gap-class errors"
 *   reason: the cli's catchTags routing acts on the tag; a batched failure
 *           would obscure routing.
 * @spec.residual-contract "Vitest reporter sidecars must already exist on disk for `--implemented` mode; their absence is a separate diagnostic class (stale-CI-artifact)"
 *   reason: lifecycle ordering; not encoded in the input shape.
 */
export const validate = (
  input: ValidateInput,
): Effect.Effect<
  ValidatePassReport,
  ValidateGapError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folders = yield* resolveFolders(fs, path, input);
    const projectCtx = yield* loadProjectCtxOrDie(fs, path);
    const validated = yield* validateFolders(
      { fs, path, mode: input.mode, projectCtx },
      folders,
    );
    return yield* finishValidate(input.folder, validated);
  }).pipe(Effect.withSpan("commands/validate"));

const loadProjectCtxOrDie = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<ProjectContext, never> =>
  loadValidateProjectContext(fs, path).pipe(
    Effect.catchTag("ProjectContextError", (e) =>
      Effect.die(new Error(`failed to load project context: ${e.cause}`)),
    ),
  );

const finishValidate = (
  folder: Option.Option<string>,
  validated: ReadonlyArray<string>,
): Effect.Effect<ValidatePassReport, ValidateGapError> =>
  validated.length === 0
    ? Effect.fail(unresolvedFolderError(requestedLabel(folder)))
    : Effect.succeed({ _tag: "pass" as const, foldersValidated: validated });

const requestedLabel = (folder: Option.Option<string>): string =>
  Option.isSome(folder) ? folder.value : "<default: src/*/>";

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
