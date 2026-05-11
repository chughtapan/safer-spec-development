/**
 * @spec.purpose
 *   Emits canonical SPEC.md from the spec-domain inputs (parsed source-side
 *   directives + per-test property declarations + sidecar payload). Canonical
 *   form: LF endings, trim trailing whitespace, lexicographic sort for
 *   filesystem lists, source-order for exports, line-numbers stripped from
 *   diff comparison, `remark-parse` for distinguishing fenced code from
 *   inline code in body prose.
 *
 *
 * @spec.guarantee Re-emission at the same tree SHA produces byte-identical
 *   output modulo `generated-at-sha`.
 *   reason: Roundtrip property on the codemod's own emit step; required by
 *           the validate gate's regenerate-and-compare check.
 */

import { Effect } from "effect";
import type { GenerateError } from "@safer/commands/generate.js";
import type { SpecArtifact } from "@safer/spec/sidecar.js";
import type { SpecFrontmatter } from "@safer/spec/frontmatter.js";

export interface EmittedSpec {
  readonly markdown: string;
  readonly sidecar: SpecArtifact;
  readonly frontmatter: SpecFrontmatter;
}

/**
 * @spec.guarantee "two calls with the same `artifact` produce byte-identical strings"
 *   reason: roundtrip contract on the emit step itself; downstream
 *           `validate` regenerate-and-compare relies on it.
 * @spec.residual-contract "internal section ordering is fixed: Purpose → Public Surface → Files → Properties → Architecture"
 *   reason: behavioral contract beyond the EmittedSpec shape.
 */
export const emitSpec = (
  _artifact: SpecArtifact,
): Effect.Effect<EmittedSpec, GenerateError> =>
  Effect.die(new Error("Not implemented: emitSpec"));
