---
name: safer-spec-init
description: Scaffold the first `SPEC.md` + property-test stub for a single folder. Use this when an existing or fresh folder needs to be onboarded to the safer-spec contract — the agent reads the folder's `index.ts` (if any), picks the right runtime-named export to bind a placeholder test against, and writes both files. Targets TTHW < 10 minutes.
---

# safer-spec-init

You are scaffolding a folder's first `SPEC.md` + property-test stub. The codemod ships `generate` and `validate` as CLI commands; `init` is a SKILL because picking the right export to bind the stub to requires reading TypeScript correctly, and a coding agent does that more reliably than a regex / ts-morph picker baked into the CLI.

## Inputs

- **Folder** the user is onboarding. If the user did not say which folder, pick a leaf folder containing an `index.ts` but no `SPEC.md`. "Leaf" means no descendant folder also lacks `SPEC.md`; the project root (`./index.ts`) loses to any descendant candidate.
- **Existing `index.ts`** (if any). If it doesn't exist, scaffold the placeholder template below. If it does exist, read it and pick the **first runtime-named export** (see *Picking the export* below).
- **Existing `SPEC.md`** in the folder → REFUSE. Tell the user "SPEC.md already exists; run `pnpm safer-spec generate --folder <folder> --write` to refresh it."

## Picking the export

When the target folder already has an `index.ts`, read it and pick **one runtime-named export** to import into the test stub. Apply these rules — they are the same rules `generate`'s sidecar regenerator uses, just enforced through your reading instead of a regex picker:

**Accept** as the stub target — direct value declarations:

```ts
export const x = 1;
export let x;            export var x;
export function x() {}   export async function x() {}
export function* x() {}  export async function* x() {}
export class X {}        export abstract class X {}
export enum X {}
export namespace X { … } export module X { … }
```

**Accept** local re-exports — the alias side is what's publicly bound:

```ts
const inner = 1; export { inner as PublicName };      // pick PublicName
import { Foo } from "./foo.js"; export { Foo };       // pick Foo
```

**Accept** re-exports from another file when that target exposes a runtime-named export. Walk one level: read the target file, apply these same rules, return the resolved name.

- `export { Foo } from "./foo.js"` → resolve `Foo` against `./foo.ts`.
- `export { foo as Bar } from "./foo.js"` → pick `Bar` (the public name).
- `export * from "./foo.js"` → first runtime-named export of `./foo.ts`.
- `export * as ns from "./foo.js"` → pick `ns` (the namespace binding) if `./foo.ts` exists.

**Skip** (do not pick these — they erase at compile time or aren't valid named imports):

- `export type T = …`, `export interface T {}`
- `export const enum E {}` (type-erased under default TS config)
- `export type { Foo }`, `export { type Foo }` (per-entry type-only)
- `export type * from …`, `export type * as ns from …`
- `export declare const x` / `export declare function x()` (ambient — no JS binding)
- `export default …` (not a named import target)
- `export { x as "x-y" }` / `export { x as class }` (non-identifier or reserved-word public names — `import { x-y }` / `import { class }` are syntax errors)
- Any export inside `/* */`, `//`, or string-literal content — only real source code counts.

If nothing in the file matches "Accept", REFUSE with: *"`<folder>/index.ts` declares no runtime-named export. Add `export const <name> = …` (or a `function` / `class` / valid re-export) before re-running, or remove the file to let this skill scaffold a placeholder."*

If you cannot tell whether a TypeScript construct is value-bearing, ask the user before writing the stub. Better one clarifying question than a stub that fails to compile.

## Files to write

### `<folder>/index.ts` (only if it doesn't already exist)

```ts
/**
 * @spec.purpose Scaffolded by `safer-spec-init`. Replace this with what the folder owns.
 */

export const placeholder = "TODO" as const;
```

Then the picked-export name in the test stub below is `placeholder`.

### `<folder>/__tests__/<slug>.spec.test.ts`

`<slug>` is the folder's base name, lowercased, with non-alphanumerics replaced by `-` and outer dashes trimmed (e.g. `packages/identity/inbound-auth` → `inbound-auth`; root folder → `root`).

```ts
/**
 * @spec.purpose Scaffolded by `safer-spec-init`. Replace this with what the tests assert.
 */

import { itSpec } from "@chughtapan/safer-spec-development";
import { <EXPORT_NAME> } from "../index.js";

/**
 * @spec.property <slug>-<export_name>-stub
 * @spec.type Constant Equality
 * @spec.exports <EXPORT_NAME>
 * @spec.claim placeholder property for the `<EXPORT_NAME>` export; promote to itSpec.prop with a real claim
 */
itSpec.todo("<slug>-<export_name>-stub", {
  type: "Constant Equality",
  exports: [<EXPORT_NAME>],
});
```

Replace `<EXPORT_NAME>` literally with the picked export name. Replace `<slug>` and `<export_name>` (lowercased identifier) in the property id and JSDoc.

## Refusals

Refuse the scaffold (do NOT write any file) when:

1. `<folder>/SPEC.md` already exists.
2. `<folder>/__tests__/<slug>.spec.test.ts` already exists. The test stub path collides with a real test file — overwriting it would clobber the user's work. Refuse even when `index.ts` is missing.
3. `<folder>/index.ts` exists AND `<folder>/__tests__/<slug>.spec.test.ts` exists (redundant with #2 but kept as documentation: "the folder is already scaffolded; refresh with `pnpm safer-spec generate --folder <folder> --write`").
4. `<folder>/index.ts` exists but contains no acceptable runtime-named export (see *Picking the export* above).

Each refusal exits cleanly. Tell the user the specific reason and the remediation step. For case 2 specifically: ask whether the existing test file is the intended owner of this stub slot — if yes, run `generate --write` against the folder instead; if not, ask where the new stub should live (a non-conflicting filename).

## After writing

Run, in this order:

```bash
pnpm safer-spec generate --folder <folder> --write
pnpm safer-spec validate --folder <folder> --planned
```

`generate` produces the canonical `SPEC.md` from the source + JSDoc + test stub. `validate --planned` verifies the directive set + drift cross-check passes. If `validate` reports a gap-class error, STOP and tell the user what it says — do not patch around it.

## Why this is a skill, not a CLI command

The first implementation of `init` lived in `src/commands/init.ts`. Twelve rounds of codex review surfaced TypeScript edge cases the picker had to learn: `const enum`, default re-exports, `export type *`, ambient `declare`, generators, namespace declarations, string-literal aliases, reserved-word aliases, `import-then-export`, transitive type-only chains, named-clause `from` resolution. Each fix worked; the picker kept growing. After the 12th round, the picker was a partial TypeScript export resolver disguised as a CLI helper.

A coding agent already reads TypeScript fluently. Move the judgment to the agent — the codemod stays small, the agent applies the rules above per call, and edge cases land as agent instructions rather than another regex tweak.
