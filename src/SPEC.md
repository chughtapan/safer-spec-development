---
folder: src
format-version: 0.1.0
generatedAtSha: 1154b4b8249204fa34505892bd114bed18c178f1
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 1
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0.9
  preconditionPassRate: 0.95
  branchCoverageFromSpecTests: 0.85
---

# SPEC

## Purpose

Library facade. Re-exports the test-author surface: the `itSpec` helper and the closed property-type taxonomy. The `SaferSpecExecutionReporter` class lives at a dedicated subpath (`@chughtapan/safer-spec-development/reporter`) so consumers can import it from `vitest.config.ts` without transitively loading `vitest`'s test API (which throws when imported from a config file). The `safer-spec` binary (commands/index.ts) is the integration point for command execution (`generate`, `validate`, `doctor`, `explain`); those are not re-exported. Folder onboarding and format-version migration ship as coding-agent skills under `skills/`, not as CLI commands.

This barrel carries `@spec.purpose` only. Per-export `@spec.assume`, `@spec.guarantee`, and `@spec.residual-contract` directives live on the declarations in their source modules.

## Public surface

### [`PROPERTY_TYPES`](./spec/grammar/property-types.ts#L37)

```ts
export const PROPERTY_TYPES = [
  "Roundtrip",
  "Partial Roundtrip",
  "Commutative Paths",
  "Constant Equality",
  "Constant Bounds Checking",
  "Constant Non-Equality",
  "Typechecking",
  "Inclusion",
  "Exception Raising",
] as const;
```

**Guarantees:**
- "membership order is stable across versions; the index of each property type is part of the contract" — _per-repo \`propertyTypesExtension\` appends only; never reorders._

**Residual contract:** none — _shape captured by \`as const\` tuple._

**Skipped property types:**
- `Partial Roundtrip` — _a constant tuple; no encode/decode pair._
- `Commutative Paths` — _a constant; no alternative path to derive it._
- `Constant Equality` — _handled by Roundtrip — calling the constant twice trivially returns the same value._
- `Exception Raising` — _a constant; cannot fail._
- `Inclusion` — _the tuple's membership IS the contract, but it's tested by \`property-types-bounded-by-paper-rounding\` (Constant Bounds Checking) which enforces the length range — that property indirectly validates inclusion since the length and order are pinned._

### [`PropertyType`](./spec/grammar/property-types.ts#L49)

```ts
export type PropertyType = (typeof PROPERTY_TYPES)[number];
```

### [`ItSpec`](./spec/grammar/it-spec.ts#L53)

```ts
export interface ItSpec {
  /**
   * @spec.assume "first positional `id` arg matches the `@spec.property` JSDoc directive value above the call site"
   *   reason: cross-check enforced by `validate --implemented`; mismatch
   *           is exit code 11 (MISSING_SPEC_PROPERTY).
   * @spec.guarantee "registers the property as a Vitest todo placeholder under `id`"
   *   reason: side-effect contract; the call mutates Vitest's collector,
   *           observable only at runtime.
   * @spec.residual-contract none
   *   reason: shape and refinements captured by parameter types.
   */
  todo(id: string, meta: PropertyMeta): void;

  /**
   * @spec.assume "JSDoc directives above this call match `id`, `meta.type`, and `meta.exports` member names"
   *   reason: cross-check enforced by `validate --implemented`.
   * @spec.guarantee "registers a fast-check property under `id` that runs `body` against samples drawn from `arb`; on completion attaches `{numRuns, numSkips}` to the Vitest task's `meta.fastCheck` slot"
   *   reason: side-effect contract; reporter reads `meta.fastCheck` to
   *           build per-folder execution sidecars.
   * @spec.residual-contract "fast-check seed and numRuns come from fast-check's own defaults (numRuns=100, seed via FC env or random); Vitest config does NOT propagate to fast-check, and this wrapper passes no override"
   *   reason: behavioral residue beyond the call signature; downstream
   *           authors need to know the property runner is not configured
   *           through Vitest.
   */
  prop<T>(
    id: string,
    meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void;
}
```

**Assumes:**
- "first positional \`id\` arg matches the \`@spec.property\` JSDoc directive value above the call site" — _cross-check enforced by \`validate --implemented\`; mismatch is exit code 11 (MISSING\_SPEC\_PROPERTY)._
- "JSDoc directives above this call match \`id\`, \`meta.type\`, and \`meta.exports\` member names" — _cross-check enforced by \`validate --implemented\`._

**Guarantees:**
- "registers the property as a Vitest todo placeholder under \`id\`" — _side-effect contract; the call mutates Vitest's collector, observable only at runtime._
- "registers a fast-check property under \`id\` that runs \`body\` against samples drawn from \`arb\`; on completion attaches \`{numRuns, numSkips}\` to the Vitest task's \`meta.fastCheck\` slot" — _side-effect contract; reporter reads \`meta.fastCheck\` to build per-folder execution sidecars._

**Residual contract:** "fast-check seed and numRuns come from fast-check's own defaults (numRuns=100, seed via FC env or random); Vitest config does NOT propagate to fast-check, and this wrapper passes no override" — _behavioral residue beyond the call signature; downstream authors need to know the property runner is not configured through Vitest._

### [`itSpec`](./spec/grammar/it-spec.ts#L142)

```ts
export const itSpec: ItSpec = {
  todo(id: string, _meta: PropertyMeta): void {
    it.todo(id);
  },
  prop<T>(
    id: string,
    _meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void {
    const property = fc.asyncProperty(arb, (sample) => Promise.resolve(body(sample)));
    // eslint-disable-next-line sonarjs/assertions-in-tests -- fc.check + Effect.fail IS the assertion; sonarjs only recognizes expect/chai/jest patterns
    it(id, (ctx) =>
      Effect.runPromise(runProperty(id, property, ctx.task.meta as TaskMetaSlot)),
    );
  },
};
```

**Guarantees:**
- "\`itSpec.todo(id, meta)\` registers a Vitest todo carrying property metadata; \`itSpec.prop(id, meta, arb, body)\` registers a Vitest property with stats sink" — _the runtime encoding of \`@spec.\*\` directive metadata; the JSDoc shape and the runtime arg shape must agree, enforced by extractProperties._

**Skipped property types:**
- `Partial Roundtrip` — _registration sink only; there is no companion that decodes a registered test back to its metadata._
- `Commutative Paths` — _two methods (\`todo\` and \`prop\`) cover orthogonal lifecycle states (stub vs implemented), not commuting paths._
- `Constant Equality` — _the object is a constant export; \`itSpec === itSpec\` is trivially true and not a property worth gating._
- `Constant Non-Equality` — _no anti-collision invariant between todo and prop methods._
- `Constant Bounds Checking` — _not a numeric/length output._
- `Inclusion` — _a method record, not a collection._
- `Roundtrip` — _registration sink only; no inverse from a registered test back to its metadata._
- `Exception Raising` — _registration is synchronous and total; property failures live INSIDE the test body the runner executes, not in \`itSpec\` itself._

## Children

- [`analysis/`](./analysis/SPEC.md) — Barrel for the \`analysis/\` layer. Exposes two high-level per-folder operations — \`generateFolder\` and \`validateFolder\` — plus the \`collectFolderInputs\` enumeration helper commands use to loop over discovered folders. Pipeline primitives (\`buildSpecMeta\`, \`regenerateMarkdown\`, \`regenerateSidecar\`, individual gap-checks, directive parsers, etc.) stay internal to this folder; commands at \`commands/{generate,validate}.ts\` compose only the two high-level functions, not the underlying machinery.  \`diagnosticLines\` and \`unresolvedFolderError\` are exposed because the cli renders gap-class errors itself (string formatting + the no-folders-resolved guard for \`--folder X\` typos).  \`buildKnownExports\` is the project-level setup the generate command computes once before looping over folders; calling it inside \`generateFolder\` would re-scan every project source on every folder.
- [`commands/`](./commands/SPEC.md) — CLI binary. Composes the four subcommands (\`generate\`, \`validate\`, \`doctor\`, \`explain\`) into the top-level \`safer-spec\` Command, then translates each tagged failure into \`process.exit(N)\` at the runtime boundary.  \`init\` and \`migrate\` are intentionally NOT CLI commands. Both are project-lifecycle flows that depend on judgment a regex / ts-morph resolver can't make reliably (which export to bind the stub to; which format-version diffs need human review). They ship as coding-agent skills (\`skills/safer-spec-init/SKILL.md\`, \`skills/safer-spec-migrate/SKILL.md\`) — the agent reads the existing barrel + spec format, scaffolds the right shape, and leaves the diff for human review.  Exit-code mapping at this boundary: - \`MissingSpecPropertyError\` → exit 11 - \`MissingStubError\`         → exit 12 - \`MissingImplError\`         → exit 13 - \`CliUsageError\`            → exit 2 (POSIX usage convention) - any other defect / failure → \`NodeRuntime.runMain\` default (non-zero)  Tagged errors \`CliExitCode\` and \`CliUsageError\` are co-located here.
- [`project/`](./project/SPEC.md) — Barrel for the \`project/\` layer. Exposes the fully-resolved \`ProjectContext\` snapshot (with precomputed folder list, per-folder subfolder map, and threshold resolver), the one loader that builds it, the stable format version, and the three tagged errors the cli routes. Folder-discovery primitives, the threshold resolver, and the path normalizer are implementation details behind \`ProjectContext\` methods.
- [`spec/`](./spec/SPEC.md) — Spec domain barrel. Anchors \`src/spec/SPEC.md\` (codemod requires every folder with a SPEC to expose an \`index.ts\` barrel) and re-exports the test-author surface (\`itSpec\`, \`ItSpec\`) consumed by the package facade. The Vitest reporter class is exposed via the dedicated \`@chughtapan/safer-spec-development/reporter\` subpath (not this barrel) so config-time consumers don't transitively load \`it-spec.ts\`'s \`vitest\` import, which throws when evaluated from a config file. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by \`commands/\` via path aliases; routing it through this barrel would be ceremony without a caller.
- [`index.ts`](./index.ts) — Library facade. Re-exports the test-author surface: the \`itSpec\` helper and the closed property-type taxonomy. The \`SaferSpecExecutionReporter\` class lives at a dedicated subpath (\`@chughtapan/safer-spec-development/reporter\`) so consumers can import it from \`vitest.config.ts\` without transitively loading \`vitest\`'s test API (which throws when imported from a config file). The \`safer-spec\` binary (commands/index.ts) is the integration point for command execution (\`generate\`, \`validate\`, \`doctor\`, \`explain\`); those are not re-exported. Folder onboarding and format-version migration ship as coding-agent skills under \`skills/\`, not as CLI commands.  This barrel carries \`@spec.purpose\` only. Per-export \`@spec.assume\`, \`@spec.guarantee\`, and \`@spec.residual-contract\` directives live on the declarations in their source modules.
- [`__tests__/facade.spec.test.ts`](./__tests__/facade.spec.test.ts) — Property tests for the package's library facade (\`src/index.ts\`). The facade re-exports \`PROPERTY\_TYPES\` + \`itSpec\` as the test-author surface; downstream packages import these via \`@chughtapan/safer-spec-development\`. Tests assert the closed property-type taxonomy (9 OOPSLA-significant kinds) is intact and the \`itSpec\` re-export resolves to the runtime helper.
- [`__tests__/sweep.spec.test.ts`](./__tests__/sweep.spec.test.ts) — Coverage-sweep tests for the package facade — adds property types beyond \`facade.spec.test.ts\` for the two exports \`PROPERTY\_TYPES\` and \`itSpec\` so each crosses the gate threshold.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `property-types-has-nine-kinds` | `Constant Equality` | `PROPERTY\_TYPES` | the closed OOPSLA property-type taxonomy has exactly 9 entries — the size validate's typeCoverage gate divides by | implemented |
| `property-types-includes-roundtrip-and-inclusion` | `Inclusion` | `PROPERTY\_TYPES` | PROPERTY\_TYPES contains both \`Roundtrip\` and \`Inclusion\` — the two OOPSLA staples test authors reach for first | implemented |
| `property-types-entries-are-unique` | `Constant Non-Equality` | `PROPERTY\_TYPES` | PROPERTY\_TYPES has no duplicate entries — every kind appears at most once in the closed taxonomy | implemented |
| `itspec-is-callable-at-the-facade` | `Typechecking` | `itSpec` | the \`itSpec\` re-exported through the package facade resolves to the same runtime helper that \`spec/grammar/it-spec.ts\` defines — function shape preserved across the barrel | implemented |
| `property-types-typechecks-as-readonly-array` | `Typechecking` | `PROPERTY\_TYPES` | \`PROPERTY\_TYPES\` is an array of strings — the type the runtime literal-union check at the directive parser boundary depends on | implemented |
| `property-types-bounded-length-paper-tier` | `Constant Bounds Checking` | `PROPERTY\_TYPES` | \`PROPERTY\_TYPES.length\` stays within 8..12 — the OOPSLA paper's 9-category vocabulary is the target; per-repo extensions append a few more, never reduce | implemented |
| `property-types-roundtrip-through-array-copy` | `Roundtrip` | `PROPERTY\_TYPES` | \`\[...PROPERTY\_TYPES\]\` produces an array with the same entries in the same order — the tuple is iterable and indexable; downstream code can safely spread without losing or reordering members | implemented |
| `itspec-todo-and-prop-methods-distinct` | `Constant Non-Equality` | `itSpec` | \`itSpec.todo\` and \`itSpec.prop\` are different function references — the codemod distinguishes stubbed from implemented properties by checking which call is at each test site | implemented |
| `itspec-todo-takes-two-args` | `Constant Equality` | `itSpec` | \`itSpec.todo\` has arity 2: \`(id, meta)\` — the stub-mode helper that doesn't take an arbitrary or body | implemented |
| `itspec-prop-takes-four-args` | `Constant Equality` | `itSpec` | \`itSpec.prop\` has arity 4: \`(id, meta, arb, body)\` — the implemented-mode helper that takes a fast-check arbitrary and a property body | implemented |
| `itspec-todo-and-prop-bounded-arity` | `Constant Bounds Checking` | `itSpec` | both \`itSpec.todo\` and \`itSpec.prop\` accept ≤4 args — the codemod's \`@spec.exports\` list correctness assumes the function-style signature, not an options-bag | implemented |
