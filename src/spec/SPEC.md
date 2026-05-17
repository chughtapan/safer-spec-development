---
folder: src/spec
format-version: 0.1.0
generatedAtSha: 7ceb4da6993ec8c2a520d21f5f51b6ee7af8aa16
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0.6666666666666666
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0.4
  preconditionPassRate: 0
  branchCoverageFromSpecTests: 0.75
---

# SPEC

## Purpose

Spec domain barrel. Anchors `src/spec/SPEC.md` (codemod requires every folder with a SPEC to expose an `index.ts` barrel) and re-exports the test-author surface (`itSpec`, `ItSpec`) consumed by the package facade. The Vitest reporter class is exposed via the dedicated `@chughtapan/safer-spec-development/reporter` subpath (not this barrel) so config-time consumers don't transitively load `it-spec.ts`'s `vitest` import, which throws when evaluated from a config file. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by `commands/` via path aliases; routing it through this barrel would be ceremony without a caller.

## Public surface

### [`ItSpec`](./grammar/it-spec.ts#L53)

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

### [`itSpec`](./grammar/it-spec.ts#L122)

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

## Children

- [`artifact/`](./artifact/SPEC.md) — Public barrel for \`spec/artifact/\`. Exposes the abstraction level downstream layers consume — \`buildSpecArtifact\`/\`emitMarkdown\` to construct the artifact, \`buildSpecMeta\`/\`findThresholdShortfall\` for coverage analysis, \`regenerateSidecar\`/\`loadExecutionSidecar\`/ \`computeTestTreeHash\` for sidecar I/O, and \`sidecarSlug\` for path construction. The lower codecs (\`serializeSidecar\`, \`decodeExecutionSidecar\`, \`hashTestTree\`, \`computeTypeCoverage\`, \`findMissingPropertyTypes\`) are implementation details consumed only by the wrappers above.  Intentional non-exports: - \`SaferSpecExecutionReporter\`: the Vitest reporter class. Exposed via the \`./reporter\` package subpath so the barrel isn't pulled in by CLI consumers. - \`decodeSpecFrontmatter\`/\`decodeSpecArtifact\`: internal helpers used by sidecar-writer's roundtrip property only. - \`escapeFor\*\` / \`relativeToFolder\` / \`SidecarWriteError\` / \`writeSidecar\`: internal to artifact, callers use the higher-level wrappers.
- [`grammar/`](./grammar/SPEC.md) — Barrel for \`spec/grammar/\`. Re-exports the \`@spec.\*\` directive parsers and the closed \`PropertyType\` vocabulary.  \`it-spec.ts\` is INTENTIONALLY NOT re-exported here. The runtime encoding of per-export directive metadata (\`itSpec.todo\` / \`itSpec.prop\`) imports Vitest's \`it\`; Vitest's module throws when loaded outside a test runner (e.g. when the \`safer-spec\` CLI binary is invoked). Re-exporting \`itSpec\` through this barrel would transitively pull Vitest into every cross-folder consumer of any grammar export (directive parsers, types, PROPERTY\_TYPES), crashing the CLI. Tests reach \`itSpec\` directly via \`@safer/spec/grammar/it-spec.js\`; the package's main facade (\`src/index.ts\`) re-exports it for downstream authors.  \`SaferSpecExecutionReporter\` in \`spec/artifact/index.ts\` has the same exclusion for the same reason.
- [`index.ts`](./index.ts) — Spec domain barrel. Anchors \`src/spec/SPEC.md\` (codemod requires every folder with a SPEC to expose an \`index.ts\` barrel) and re-exports the test-author surface (\`itSpec\`, \`ItSpec\`) consumed by the package facade. The Vitest reporter class is exposed via the dedicated \`@chughtapan/safer-spec-development/reporter\` subpath (not this barrel) so config-time consumers don't transitively load \`it-spec.ts\`'s \`vitest\` import, which throws when evaluated from a config file. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by \`commands/\` via path aliases; routing it through this barrel would be ceremony without a caller.
- [`__tests__/spec.spec.test.ts`](./__tests__/spec.spec.test.ts) — Property tests for \`spec/\`'s author-facing surface. The folder barrel re-exports \`itSpec\` (the test-author runtime) from \`spec/grammar/it-spec.ts\`. Tests assert the shape of \`itSpec\` — its methods, their signatures, and the consistency between the runtime value and the \`ItSpec\` interface it implements.
- [`__tests__/sweep.spec.test.ts`](./__tests__/sweep.spec.test.ts) — Coverage-sweep tests for the \`spec/\` facade — adds property types beyond \`spec.spec.test.ts\` for the single export \`itSpec\` so it crosses the gate threshold.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `itspec-exposes-todo-and-prop-methods` | `Inclusion` | `itSpec` | \`itSpec\` exposes exactly the methods \`todo\` and \`prop\` — the two-shape author API the codemod's cross-check expects to find at every itSpec call site | implemented |
| `itspec-todo-and-prop-are-functions` | `Typechecking` | `itSpec` | \`itSpec.todo\` and \`itSpec.prop\` are both functions — the runtime shape downstream test authors call | implemented |
| `itspec-todo-arity` | `Constant Equality` | `itSpec` | \`itSpec.todo\` has arity 2 (id, meta) — matching the documented \`ItSpec\["todo"\]\` signature | implemented |
| `itspec-prop-arity` | `Constant Equality` | `itSpec` | \`itSpec.prop\` has arity 4 (id, meta, arb, body) — matching the documented \`ItSpec\["prop"\]\` signature | implemented |
| `itspec-todo-prop-distinct-references` | `Constant Non-Equality` | `itSpec` | \`itSpec.todo\` and \`itSpec.prop\` are different function references — \`extractProperties\` distinguishes stubs from implemented bodies by checking which method was called at each test site | implemented |
| `itspec-bounded-method-count` | `Constant Bounds Checking` | `itSpec` | \`itSpec\` exposes exactly two methods (\`todo\`, \`prop\`) — the closed API surface the codemod's directive parser keys on | implemented |
| `itspec-roundtrip-method-call-shape` | `Roundtrip` | `itSpec` | \`itSpec.todo\` and \`itSpec.prop\` are both function-typed — calling either with an \`id\` and \`meta\` doesn't throw at the type level (regardless of runtime side effects) | implemented |
| `itspec-includes-todo-key` | `Inclusion` | `itSpec` | \`itSpec\` exposes \`todo\` as an own property key — the surface every test file imports via \`itSpec.todo(...)\` | implemented |
