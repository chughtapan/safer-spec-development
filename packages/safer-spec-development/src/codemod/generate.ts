/**
 * @spec.purpose
 *   `generate` mode entrypoint. Scrapes source + JSDoc + properties + eslint
 *   config; emits SPEC.md per folder plus `.safer-spec/<folder>.json`
 *   structured sidecar. Idempotent steady-state regeneration in canonical
 *   form. Composes glob → ts-morph → jsdoc-parser → kind-detector →
 *   applicability → section-emitter → reporter.sidecar-writer.
 */

import type { FileSystem, Path } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { GenerateError } from "../errors/index.js";

export interface GenerateInput {
  readonly folder: string | null;
  readonly write: boolean;
  readonly dryRun: boolean;
  readonly watch: boolean;
}

export interface GenerateResult {
  readonly foldersTouched: ReadonlyArray<string>;
  readonly filesWritten: ReadonlyArray<string>;
  readonly diff: string;
}

export const generate = (
  _input: GenerateInput,
): Effect.Effect<
  GenerateResult,
  GenerateError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: generate not implemented"));
