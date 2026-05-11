/**
 * @spec.purpose
 *   `validate` mode entrypoint. Runs `generate` to memory, diffs against
 *   on-disk artifacts, reads Vitest reporter sidecars, asserts the gate
 *   classes, and fails on the typed error channel with one of three
 *   tagged errors named for the gap class.
 *
 *   `validate --implemented` performs four cross-checks:
 *     (a) Every `itSpec.prop`/`itSpec.todo` call site has the four required
 *         JSDoc directives (`@spec.property`, `@spec.type`, `@spec.exports`,
 *         `@spec.claim`). Missing → `MissingStubError`.
 *     (b) JSDoc directive values match the runtime `meta` argument
 *         (id ↔ `@spec.property`, kind ↔ `@spec.type`, exports member names
 *         ↔ `@spec.exports`). Mismatch → `MissingSpecPropertyError`.
 *     (c) Committed SPEC.md `## Properties` table is byte-equal to the
 *         re-generated table (the table is GENERATED from test JSDoc; hand
 *         edits are drift). Drift → `MissingSpecPropertyError`.
 *     (d) Every `itSpec.prop` body is non-empty (not `it.todo`, not empty
 *         fast-check). Empty → `MissingImplError`.
 *
 *   Tagged errors `MissingSpecPropertyError`, `MissingStubError`,
 *   `MissingImplError` are co-located here. `commands/index.ts` translates each
 *   tag into a process exit code at the runtime boundary
 *   (MissingSpecPropertyError → 11, MissingStubError → 12,
 *   MissingImplError → 13).
 *
 *   `--planned` mode: kind-metadata-only check; classifier-coverage and
 *   precondition-pass-rate gates are skipped.
 *
 *   `--implemented` mode: full gate including (a) — (d).
 *
 *   Caller pattern:
 *     ```ts
 *     validate(input).pipe(
 *       Effect.catchTags({
 *         MissingSpecPropertyError: (e) => ...,
 *         MissingStubError:         (e) => ...,
 *         MissingImplError:         (e) => ...,
 *       })
 *     )
 *     ```
 */

/* eslint-disable max-classes-per-file -- the validate mode's three
   gap-class errors are one tagged-union variant per failure class; co-locating
   them with the function that emits them is per-domain ownership. */

import type { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Option, Schema } from "effect";

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
 * @spec.guarantee "emitted only when a Properties row in SPEC.md fails to match a corresponding test-side directive (cross-check b) or the regenerated table differs from the committed one (cross-check c)"
 *   reason: spec-tier ratchet; cli translates this tag to exit code 11.
 * @spec.residual-contract "diagnostic.problem text is human-readable; downstream agents read .diagnostic.fix to route the next step"
 *   reason: trust contract for diagnostic body content.
 */
class MissingSpecPropertyError extends Data.TaggedError(
  "MissingSpecPropertyError",
)<GapErrorPayload> {}

/**
 * @spec.guarantee "emitted when an itSpec call site lacks the four required JSDoc directives, or when no itSpec call exists for a Properties row"
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
 * Tag to POSIX exit code mapping for the three gap-class errors. This map
 * ties each code to the exact tagged-error class that triggers it. The
 * `satisfies` clause guarantees every `ValidateGapError["_tag"]` is mapped at
 * compile time.
 */
export const VALIDATE_GAP_EXIT_CODES = {
  MissingSpecPropertyError: 11,
  MissingStubError: 12,
  MissingImplError: 13,
} as const satisfies Record<ValidateGapError["_tag"], number>;

interface ValidateInput {
  /** `Option.none()` validates every folder under cwd; `Option.some(path)` scopes to one. */
  readonly folder: Option.Option<string>;
  readonly mode: "planned" | "implemented";
  readonly formatVersionCheck: boolean;
}

interface ValidatePassReport {
  readonly _tag: "pass";
  readonly foldersValidated: ReadonlyArray<string>;
}

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
  _input: ValidateInput,
): Effect.Effect<
  ValidatePassReport,
  ValidateGapError,
  FileSystem.FileSystem | Path.Path
> => Effect.die(new Error("Not implemented: validate"));

/**
 * @spec.guarantee "output string is the canonical user-facing diagnostic body for the given gap-class error"
 *   reason: the CLI binary writes this directly to stderr; no further
 *           shaping happens at the runtime boundary.
 * @spec.residual-contract none
 *   reason: pure transformation; output shape derived from input.
 */
export const formatDiagnostic = (
  _err: ValidateGapError,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Not implemented: formatDiagnostic"));
