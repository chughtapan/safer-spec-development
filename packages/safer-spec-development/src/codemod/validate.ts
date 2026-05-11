/**
 * @spec.purpose
 *   `validate` mode entrypoint. Runs `generate` to memory, diffs against
 *   on-disk artifacts, reads Vitest reporter sidecars, asserts the three gate
 *   classes, and emits one of the {11, 12, 13} gap-class exit codes per the
 *   Stage 5 spec's `## Amendment 5 mapping` (sub-issue #3).
 *
 *   Exit-code contract (per Stage 5 spec source-properties + Amendment 5):
 *     0  → pass.
 *     11 → MISSING_SPEC_PROPERTY (spec-tier ratchet; the consuming SPEC.md's
 *          `## Properties` table has no row whose observation surface targets
 *          the export AND whose kind matches the applicability matrix).
 *     12 → MISSING_STUB (architect-tier ratchet; a `## Properties` row exists
 *          with no colocated `it.todo` / `it.prop` declaration).
 *     13 → MISSING_IMPL (implementer-tier BLOCK; an `it.prop` declaration
 *          exists with an empty fast-check body).
 *
 *   `--planned` mode: kind-metadata-only check; classifier-coverage and
 *   precondition-pass-rate gates are skipped. Architect-PR-tolerant.
 *
 *   `--implemented` mode: full gate.
 *
 * @spec.guarantee Every emitted diagnostic conforms to
 *   `{ problem, cause, fix, docsLink }` (Stage 5 source property
 *   `validate-diagnostic-shape`).
 *   reason: structured diagnostics are the contract the orchestrator's Step-5d
 *           routing consumes.
 */

import type { FileSystem, Path } from "@effect/platform";
import { Schema, type Effect } from "effect";
import { Effect as Eff } from "effect";
import type { ValidateError } from "../errors/index.js";

export const ValidateDiagnostic = Schema.Struct({
  problem: Schema.String,
  cause: Schema.String,
  fix: Schema.String,
  docsLink: Schema.String,
});

export type ValidateDiagnostic = Schema.Schema.Type<typeof ValidateDiagnostic>;

export const GAP_CLASS_EXIT_CODES = {
  MISSING_SPEC_PROPERTY: 11 as const,
  MISSING_STUB: 12 as const,
  MISSING_IMPL: 13 as const,
};

export type GapClass = keyof typeof GAP_CLASS_EXIT_CODES;
export type GapExitCode = (typeof GAP_CLASS_EXIT_CODES)[GapClass];

export interface ValidateInput {
  readonly folder: string | null;
  readonly mode: "planned" | "implemented";
  readonly formatVersionCheck: boolean;
}

export interface ValidatePassReport {
  readonly _tag: "pass";
  readonly foldersValidated: ReadonlyArray<string>;
}

export interface ValidateFailReport {
  readonly _tag: "fail";
  readonly exitCode: GapExitCode;
  readonly gapClass: GapClass;
  readonly diagnostic: ValidateDiagnostic;
  readonly location: string;
}

export type ValidateReport = ValidatePassReport | ValidateFailReport;

export const validate = (
  _input: ValidateInput,
): Effect.Effect<
  ValidateReport,
  ValidateError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: validate not implemented"));

export const validateFolder = (
  _folder: string,
  _mode: "planned" | "implemented",
): Effect.Effect<
  ValidateReport,
  ValidateError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: validateFolder not implemented"));

export const formatDiagnostic = (
  _exitCode: GapExitCode,
  _diagnostic: ValidateDiagnostic,
): Effect.Effect<string, never> =>
  Eff.die(new Error("Stage 1 stub: formatDiagnostic not implemented"));
