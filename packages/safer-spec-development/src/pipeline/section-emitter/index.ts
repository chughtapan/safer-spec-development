/**
 * @spec.purpose
 *   Emits canonical SPEC.md from the resolved export set. Canonical form: LF
 *   endings, trim trailing whitespace, lexicographic sort for filesystem lists,
 *   source-order sort for exports, line-numbers stripped from diff comparison,
 *   `remark-parse` for distinguishing fenced code from inline code in body
 *   prose. Per design doc Recommended Approach §6.
 *
 * @spec.guarantee Re-emission at the same tree SHA produces byte-identical
 *   output modulo `generated-at-sha`.
 *   reason: Roundtrip property on the codemod's own emit step; required by
 *           Stage 5 source property `validate-gate-determ`.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { GenerateError } from "../../errors/index.js";
import type { SpecArtifact } from "../../kernel/index.js";
import type { SpecFrontmatter } from "../../kernel/index.js";

export interface EmittedSpec {
  readonly markdown: string;
  readonly sidecar: SpecArtifact;
  readonly frontmatter: SpecFrontmatter;
}

export const emitSpec = (
  _artifact: SpecArtifact,
): Effect.Effect<EmittedSpec, GenerateError> =>
  Eff.die(new Error("Stage 1 stub: emitSpec not implemented"));

export const emitFrontmatter = (
  _frontmatter: SpecFrontmatter,
): Effect.Effect<string, GenerateError> =>
  Eff.die(new Error("Stage 1 stub: emitFrontmatter not implemented"));

export const emitPurposeSection = (
  _purpose: string,
): Effect.Effect<string, GenerateError> =>
  Eff.die(new Error("Stage 1 stub: emitPurposeSection not implemented"));

export const emitArchitectureSection = (
  _input: {
    readonly layer: string | null;
    readonly importsAllowed: ReadonlyArray<{ path: string; reason: string }>;
    readonly importsForbidden: ReadonlyArray<{ path: string; reason: string }>;
  },
): Effect.Effect<string, GenerateError> =>
  Eff.die(new Error("Stage 1 stub: emitArchitectureSection not implemented"));

export const emitPublicSurfaceSection = (
  _artifact: SpecArtifact,
): Effect.Effect<string, GenerateError> =>
  Eff.die(new Error("Stage 1 stub: emitPublicSurfaceSection not implemented"));

export const emitFilesSection = (
  _files: ReadonlyArray<{ name: string; role: string }>,
): Effect.Effect<string, GenerateError> =>
  Eff.die(new Error("Stage 1 stub: emitFilesSection not implemented"));

export const emitPropertiesSection = (
  _properties: ReadonlyArray<{ propertyId: string; kind: string; observationSurface: string }>,
): Effect.Effect<string, GenerateError> =>
  Eff.die(new Error("Stage 1 stub: emitPropertiesSection not implemented"));
