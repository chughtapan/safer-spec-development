/**
 * @spec.purpose
 *   `validate` command entrypoint. Walks each folder that has an `index.ts`
 *   barrel, runs the same analysis pipeline as `generate`, diffs the
 *   regenerated SPEC.md against the on-disk artifact, and reports gap-class
 *   failures via one of three tagged errors mapped to POSIX exit codes
 *   {11, 12, 13}.
 *
 *   Tagged errors `MissingSpecPropertyError`, `MissingStubError`, and
 *   `MissingImplError` are co-located here. `commands/index.ts` translates
 *   each tag at the runtime boundary.
 *
 *   `--planned`: regenerate + on-disk diff; per-test directive completeness
 *   is enforced by the parser already (call sites that lack any of the four
 *   required tags are silently dropped by `extractProperties`; their absence
 *   from the `## Properties` table surfaces as a drift error via the diff
 *   check).
 *
 *   `--implemented`: planned-mode checks plus every `itSpec.prop` body is
 *   non-empty (no `itSpec.todo` placeholder).
 *
 *   Diagnostics carry a problem / cause / fix / docsLink quartet so agents
 *   can route the next remediation step.
 */

/* eslint-disable max-classes-per-file -- the validate command's three
   gap-class errors are one tagged-union variant per failure class; co-locating
   them with the function that emits them is per-domain ownership. */

import { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Option, Schema } from "effect";
import {
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
  JsDocUnknownDirectiveError,
} from "@safer/spec/directives/index.js";
import {
  buildSpecMeta,
  collectFolderInputs,
  discoverFolders,
  inspectFolder,
  loadValidateProjectContext,
  regenerateMarkdown,
  type FolderInputs,
  type ProjectContext,
} from "@safer/commands/validate-pipeline.js";
import type { ItSpecIssue } from "@safer/spec/todos.js";

const ValidateDiagnosticSchema = Schema.Struct({
  problem: Schema.String,
  cause: Schema.String,
  fix: Schema.String,
  docsLink: Schema.String,
});

type ValidateDiagnostic = Schema.Schema.Type<typeof ValidateDiagnosticSchema>;

interface GapErrorPayload {
  readonly location: string;
  readonly diagnostic: ValidateDiagnostic;
}

/**
 * @spec.guarantee "emitted when committed SPEC.md drifts from the regenerated output, or when a Properties row fails its test-side directive cross-check"
 *   reason: spec-tier ratchet; cli translates this tag to exit code 11.
 * @spec.residual-contract "diagnostic.problem is human-readable; agents read .diagnostic.fix to route remediation"
 *   reason: trust contract for diagnostic body content.
 */
class MissingSpecPropertyError extends Data.TaggedError(
  "MissingSpecPropertyError",
)<GapErrorPayload> {}

/**
 * @spec.guarantee "emitted when an itSpec call site lacks the four required JSDoc directives, or when a JSDoc directive fails to parse"
 *   reason: stub-tier ratchet; cli translates this tag to exit code 12.
 * @spec.residual-contract "diagnostic.location names the call site (file:line)"
 *   reason: trust contract for routing the next remediation step.
 */
class MissingStubError extends Data.TaggedError(
  "MissingStubError",
)<GapErrorPayload> {}

/**
 * @spec.guarantee "emitted when an itSpec.prop call has an empty fast-check body or has been left as itSpec.todo despite the property graduating to implemented state"
 *   reason: implementation-tier block; cli translates this tag to exit code 13.
 * @spec.residual-contract "diagnostic.cause names the reason the body is empty"
 *   reason: trust contract for routing the next remediation step.
 */
class MissingImplError extends Data.TaggedError(
  "MissingImplError",
)<GapErrorPayload> {}

export type ValidateGapError =
  | MissingSpecPropertyError
  | MissingStubError
  | MissingImplError;

/**
 * Tag-to-POSIX exit code mapping for the three gap-class errors. The
 * `satisfies` clause guarantees every `ValidateGapError["_tag"]` is mapped at
 * compile time.
 */
export const VALIDATE_GAP_EXIT_CODES = {
  MissingSpecPropertyError: 11,
  MissingStubError: 12,
  MissingImplError: 13,
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

const DOCS_BASE =
  "https://github.com/chughtapan/safer-spec-development/blob/main/docs";

const mkDiagnostic = (
  problem: string,
  cause: string,
  fix: string,
  anchor: string,
): ValidateDiagnostic => ({
  problem,
  cause,
  fix,
  docsLink: `${DOCS_BASE}/errors.md#${anchor}`,
});

const directiveErrorToStub = (
  e: JsDocDirectiveOverflowError | JsDocDirectiveParseError | JsDocUnknownDirectiveError,
): MissingStubError =>
  new MissingStubError({
    location: `${e.path}:${String(e.line)}`,
    diagnostic: mkDiagnostic(
      `directive ${e._tag}`,
      `tag \`${e.directive}\``,
      "fix the JSDoc directive on the call site",
      "missing-stub",
    ),
  });

const catchDirectiveErrors = <A, R>(
  eff: Effect.Effect<
    A,
    JsDocDirectiveOverflowError | JsDocDirectiveParseError | JsDocUnknownDirectiveError,
    R
  >,
): Effect.Effect<A, MissingStubError, R> =>
  eff.pipe(
    Effect.catchTags({
      JsDocDirectiveOverflowError: (e) => Effect.fail(directiveErrorToStub(e)),
      JsDocDirectiveParseError: (e) => Effect.fail(directiveErrorToStub(e)),
      JsDocUnknownDirectiveError: (e) => Effect.fail(directiveErrorToStub(e)),
    }),
  );

const driftError = (specPath: string, reason: string): MissingSpecPropertyError =>
  new MissingSpecPropertyError({
    location: specPath,
    diagnostic: mkDiagnostic(
      "committed SPEC.md drifted from regenerated output",
      reason,
      "run `safer-spec generate --write` to refresh",
      "missing-spec-property",
    ),
  });

const SHA_LINE_RE = /^generatedAtSha:.*$/m;
const stripVolatileMd = (text: string): string =>
  text.replace(SHA_LINE_RE, "generatedAtSha: <NORMALIZED>");

const checkDrift = (
  fs: FileSystem.FileSystem,
  specPath: string,
  regenerated: string,
): Effect.Effect<void, MissingSpecPropertyError> =>
  fs.readFileString(specPath).pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.fail(driftError(specPath, "no SPEC.md on disk for this folder")),
      onSuccess: (onDisk) =>
        stripVolatileMd(onDisk) === stripVolatileMd(regenerated)
          ? Effect.succeed(void 0)
          : Effect.fail(
              driftError(specPath, "on-disk bytes differ from re-emit"),
            ),
    }),
  );

const checkImplBodies = (
  analysis: { readonly properties: ReadonlyArray<{ readonly id: string; readonly stubbed: boolean; readonly sourceRef: { readonly path: string; readonly line: number } }> },
): Effect.Effect<void, MissingImplError> => {
  const stubbed = analysis.properties.find((p) => p.stubbed);
  if (stubbed === undefined) return Effect.succeed(void 0);
  return Effect.fail(
    new MissingImplError({
      location: `${stubbed.sourceRef.path}:${String(stubbed.sourceRef.line)}`,
      diagnostic: mkDiagnostic(
        `property \`${stubbed.id}\` is still a placeholder`,
        "itSpec.todo has not yet been promoted to itSpec.prop with a fast-check body",
        `replace itSpec.todo("${stubbed.id}", ...) with itSpec.prop(...)`,
        "missing-impl",
      ),
    }),
  );
};

const issueToError = (issue: ItSpecIssue): ValidateGapError => {
  const location = `${issue.path}:${String(issue.line)}`;
  if (issue.kind === "missing-directive") {
    return new MissingStubError({
      location,
      diagnostic: mkDiagnostic(
        "itSpec call site missing required JSDoc directive(s)",
        issue.detail,
        "add the missing @spec.property / @spec.type / @spec.exports / @spec.claim block above the call",
        "missing-stub",
      ),
    });
  }
  if (issue.kind === "directive-mismatch") {
    return new MissingSpecPropertyError({
      location,
      diagnostic: mkDiagnostic(
        "JSDoc directive disagrees with itSpec runtime argument",
        issue.detail,
        "make the JSDoc directive and the itSpec call argument refer to the same value",
        "missing-spec-property",
      ),
    });
  }
  return new MissingImplError({
    location,
    diagnostic: mkDiagnostic(
      "itSpec.prop body is empty",
      issue.detail,
      "replace the empty body with a fast-check property assertion",
      "missing-impl",
    ),
  });
};

const failOnIssues = (
  issues: ReadonlyArray<ItSpecIssue>,
  mode: "planned" | "implemented",
): Effect.Effect<void, ValidateGapError> => {
  const filtered = mode === "planned"
    ? issues.filter((i) => i.kind !== "empty-body")
    : issues;
  if (filtered.length === 0) return Effect.succeed(void 0);
  return Effect.fail(issueToError(filtered[0]!));
};

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
      inspectFolder(ctx.fs, folder, inputs, ctx.projectCtx),
    );
    yield* failOnIssues(inspection.issues, ctx.mode);
    const meta = buildSpecMeta(inspection.analysis, ctx.projectCtx);
    const regenerated = regenerateMarkdown(inspection.analysis, meta);
    yield* checkDrift(ctx.fs, ctx.path.join(folder, "SPEC.md"), regenerated);
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
    ? Effect.succeed([input.folder.value])
    : discoverFolders(fs, path, "src");

/**
 * @spec.assume "the underlying `generate` step is deterministic at the same tree SHA"
 *   reason: cross-check (c) above relies on byte-equality between the
 *           on-disk SPEC.md and the regenerated one.
 * @spec.guarantee "first failing check short-circuits and emits exactly one of the three gap-class errors"
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
    const projectCtx = yield* loadValidateProjectContext(fs, path).pipe(
      Effect.catchTag("ProjectContextError", (e) =>
        Effect.die(new Error(`failed to load project context: ${e.cause}`)),
      ),
    );
    const validated = yield* validateFolders(
      { fs, path, mode: input.mode, projectCtx },
      folders,
    );
    return { _tag: "pass" as const, foldersValidated: validated };
  }).pipe(Effect.withSpan("commands/validate"));

const diagnosticLines = (
  tag: ValidateGapError["_tag"],
  payload: GapErrorPayload,
): ReadonlyArray<string> => [
  `[${tag}] ${payload.diagnostic.problem}`,
  `  location: ${payload.location}`,
  `  cause:    ${payload.diagnostic.cause}`,
  `  fix:      ${payload.diagnostic.fix}`,
  `  docs:     ${payload.diagnostic.docsLink}`,
];

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
