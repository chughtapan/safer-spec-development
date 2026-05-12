/**
 * @spec.purpose Property stubs for the `validate` command entrypoint. Validate
 *   enforces four cross-checks: JSDoc directives exist on every itSpec call,
 *   JSDoc values match runtime metadata, committed SPEC.md equals regenerated
 *   output, and every implemented property has a non-empty body.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { formatDiagnostic, validate } from "@safer/commands/validate.js";

/**
 * @spec.property validate-gate-determ
 * @spec.type Roundtrip
 * @spec.exports validate
 * @spec.claim two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha
 */
itSpec.todo("validate-gate-determ", {
  type: "Roundtrip",
  exports: [validate],
});

/**
 * @spec.property validate-emits-gap-cls
 * @spec.type Exception Raising
 * @spec.exports validate
 * @spec.claim every gate failure emits a typed ValidateError with gapClass in {11, 12, 13}
 */
itSpec.todo("validate-emits-gap-cls", {
  type: "Exception Raising",
  exports: [validate],
});

/**
 * @spec.property validate-diagnostic-shape
 * @spec.type Typechecking
 * @spec.exports validate, formatDiagnostic
 * @spec.claim every emitted diagnostic conforms to {problem, cause, fix, docsLink}
 */
itSpec.todo("validate-diagnostic-shape", {
  type: "Typechecking",
  exports: [validate, formatDiagnostic],
});

/**
 * @spec.property properties-table-self-host
 * @spec.type Inclusion
 * @spec.exports validate
 * @spec.claim the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc
 */
itSpec.todo("properties-table-self-host", {
  type: "Inclusion",
  exports: [validate],
});

/**
 * @spec.property properties-table-self-host-bodied
 * @spec.type Inclusion
 * @spec.exports validate
 * @spec.claim every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body)
 */
itSpec.todo("properties-table-self-host-bodied", {
  type: "Inclusion",
  exports: [validate],
});

/**
 * @spec.property validate-flags-misplaced-per-export-directive
 * @spec.type Exception Raising
 * @spec.exports validate
 * @spec.claim a per-export directive (`@spec.assume`/`@spec.guarantee`/`@spec.residual-contract`/`@spec.skip`) placed in file-level JSDoc, or naming a symbol the folder doesn't export, fails as MissingSpecPropertyError with exit code 11
 */
itSpec.todo("validate-flags-misplaced-per-export-directive", {
  type: "Exception Raising",
  exports: [validate],
});

/**
 * @spec.property validate-drift-gate-uses-folder-wide-export-set
 * @spec.type Constant Equality
 * @spec.exports validate
 * @spec.claim directives that reference internal helpers (exported by a non-barrel source file in the folder) validate successfully; the drift gate's known-exports set is the union of every local source file's exports, not the barrel only
 */
itSpec.todo("validate-drift-gate-uses-folder-wide-export-set", {
  type: "Constant Equality",
  exports: [validate],
});

/**
 * @spec.property validate-drift-ignores-external-source-directives
 * @spec.type Constant Equality
 * @spec.exports validate
 * @spec.claim a barrel re-exporting a subset of symbols from a sibling-folder source file validates without flagging the source file's other (unrelated) per-export directives as drift; drift checks scope to local sources only
 */
itSpec.todo("validate-drift-ignores-external-source-directives", {
  type: "Constant Equality",
  exports: [validate],
});

/**
 * @spec.property validate-records-git-worktree-head-sha
 * @spec.type Constant Equality
 * @spec.exports validate
 * @spec.claim when run from a git worktree (`.git` is a file with a `gitdir:` pointer, not a directory), `generatedAtSha` resolves to the actual HEAD SHA via the pointer, not `uncommitted`
 */
itSpec.todo("validate-records-git-worktree-head-sha", {
  type: "Constant Equality",
  exports: [validate],
});
