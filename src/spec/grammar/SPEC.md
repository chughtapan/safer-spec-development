---
folder: src/spec/grammar
format-version: 0.1.0
generatedAtSha: 4a84c8a158ef9e717ac64d92d72ea82c1daa7ccd
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0.050505050505050504
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0
  classifierCoverage: 0
  preconditionPassRate: 0
---

# SPEC

## Purpose

Barrel for `spec/grammar/`. Re-exports the `@spec.*` directive parsers, the closed `PropertyType` vocabulary, and the `itSpec` runtime encoding. The directive grammar has two sides — JSDoc (authored, parsed) and runtime (`itSpec.todo`/`itSpec.prop`) — both expressed here. `validate --implemented` cross-checks the two encodings.

## Public surface

### [`PROPERTY_TYPES`](./property-types.ts#L27)

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

### [`JsDocDirectiveOverflowError`](./shared.ts#L28)

```ts
export class JsDocDirectiveOverflowError extends Data.TaggedError(
  "JsDocDirectiveOverflowError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly length: number;
  readonly limit: number;
}> { /* ... */ }
```

### [`JsDocDirectiveParseError`](./shared.ts#L38)

```ts
export class JsDocDirectiveParseError extends Data.TaggedError(
  "JsDocDirectiveParseError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly reason: string;
}> { /* ... */ }
```

### [`PropertyType`](./property-types.ts#L39)

```ts
export type PropertyType = (typeof PROPERTY_TYPES)[number];
```

### [`JsDocUnknownDirectiveError`](./shared.ts#L47)

```ts
export class JsDocUnknownDirectiveError extends Data.TaggedError(
  "JsDocUnknownDirectiveError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}> { /* ... */ }
```

### [`ItSpec`](./it-spec.ts#L54)

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
   * @spec.guarantee "registers a fast-check property under `id` that runs `body` against samples drawn from `arb`; on completion attaches `{numRuns, numSkips, classifiers}` to the Vitest task's `meta.fastCheck` slot"
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
- "registers a fast-check property under \`id\` that runs \`body\` against samples drawn from \`arb\`; on completion attaches \`{numRuns, numSkips, classifiers}\` to the Vitest task's \`meta.fastCheck\` slot" — _side-effect contract; reporter reads \`meta.fastCheck\` to build per-folder execution sidecars._

**Residual contract:** "fast-check seed and numRuns come from fast-check's own defaults (numRuns=100, seed via FC env or random); Vitest config does NOT propagate to fast-check, and this wrapper passes no override" — _behavioral residue beyond the call signature; downstream authors need to know the property runner is not configured through Vitest._

### [`ParseError`](./shared.ts#L55)

```ts
export type ParseError =
  | JsDocDirectiveOverflowError
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError;
```

### [`Directive`](./directives.ts#L69)

```ts
export type Directive =
  | PurposeDirective
  | IgnoreFileDirective
  | AssumeDirective
  | GuaranteeDirective
  | ResidualContractDirective
  | SkipDirective
  | IgnoreExportDirective
  | PropertyDirective
  | TypeDirective
  | ExportsDirective
  | ClaimDirective;
```

### [`LocatedDirective`](./directives.ts#L89)

```ts
export interface LocatedDirective {
  readonly directive: Directive;
  readonly location: DirectiveLocation;
}
```

### [`itSpec`](./it-spec.ts#L121)

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

### [`parseFileDirectives`](./directives.ts#L284)

```ts
export const parseFileDirectives = (
  path: string,
  source: string,
): Effect.Effect<ReadonlyArray<LocatedDirective>, ParseError> => /* ... */
```

**Guarantees:**
- "every emitted directive validates against the closed grammar before downstream consumption" — _trust-boundary; agents consume parsed directive bodies as context._

## Children

- [`directives.ts`](./directives.ts) — Directive grammar entry point. Walks TypeScript source via ts-morph and dispatches each parsed TSDoc block (via \`tsdoc-bridge\`) to its per-population parser. Returns the typed \`LocatedDirective\` stream.  The population modules (\`file-level\`, \`per-export\`, \`per-test\`) co-locate each directive's Schema with its parse function. The \`tsdoc-bridge\` module owns the TSDoc configuration and the byte-accurate body extraction.
- [`file-level.ts`](./file-level.ts) — File-level directives — \`@spec.purpose\` and \`@spec.ignore\`. These attach to \`index.ts\` barrels; the parser treats their location \`exportName\` as \`null\`.
- [`index.ts`](./index.ts) — Barrel for \`spec/grammar/\`. Re-exports the \`@spec.\*\` directive parsers, the closed \`PropertyType\` vocabulary, and the \`itSpec\` runtime encoding. The directive grammar has two sides — JSDoc (authored, parsed) and runtime (\`itSpec.todo\`/\`itSpec.prop\`) — both expressed here. \`validate --implemented\` cross-checks the two encodings.
- [`it-spec.ts`](./it-spec.ts) — Author-facing test helper. Terminal domain — \`itSpec\` is the public surface every spec author imports to declare property stubs. Wraps Vitest's \`it.todo\` and \`it.prop\` so authors get typed \`(id, opts, arb, body)\` ergonomics, AND the codemod can read property metadata back from each call site at codemod time.  Every \`itSpec.prop\`/\`itSpec.todo\` call carries four required JSDoc directives above it (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`). \`generate\` walks \`\*.spec.test.ts\` files, parses these directives, and emits the colocated SPEC.md \`## Properties\` table from the tests. The runtime \`meta\` argument carries the same metadata for \`validate --implemented\` to cross-check JSDoc against runtime opts.  \`prop\` additionally attaches the fast-check \`RunDetails\` (numRuns, numSkips) to the Vitest task's \`meta.fastCheck\` slot so the execution reporter at \`spec/reporter.ts\` can aggregate per-folder coverage stats into the per-folder \`.safer-spec/&lt;slug&gt;.execution.json\` artifact validate decodes through its co-located Schema.
- [`per-export.ts`](./per-export.ts) — Per-export directives — \`@spec.assume\`, \`@spec.guarantee\`, \`@spec.residual-contract\`, \`@spec.skip\`, \`@spec.ignore-export\`. These attach to public-surface exported declarations; the parser records the declaration's name in \`location.exportName\`. Each directive in this population carries a required \`reason:\` line.
- [`per-test.ts`](./per-test.ts) — Per-test directives — \`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`. These attach above each \`itSpec.prop\`/\`itSpec.todo\` call site; the parser records \`location.exportName\` as \`null\`.
- [`property-types.ts`](./property-types.ts) — Closed taxonomy of property assertion types. Terminal domain — no upward dependencies.  The 9 OOPSLA-significant property types (Roundtrip, Inclusion, Exception Raising, …). Source: Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered to the 9 statistically significant ones. Dropped: Generated-Expression Bounds Checking (p=0.0627), Generated-Expression Non-Equality (p=0.3299), Constant Inclusion (p=0.8969).  The codemod assumes ALL property types apply to every export by default. Opting out is explicit via per-export \`@spec.skip "&lt;PropertyType&gt;" reason: &lt;why&gt;\` directives. There is no built-in matrix mapping export shapes to required property types — that prescription belongs in the author's \`@spec.skip\` reasons, not in the tool.  Per-repo extension via \`safer-spec.config.ts\` \`propertyTypesExtension: PropertyType\[\]\`.
- [`shared.ts`](./shared.ts) — Shared infrastructure for the per-population directive modules: size caps, the \`ParseError\` union, the three tagged errors the parser can emit, and the small string helpers each population uses (unquote, splitReason).
- [`tsdoc-bridge.ts`](./tsdoc-bridge.ts) — \`@microsoft/tsdoc\` adapter layer. Owns the TSDoc configuration (closed set of \`@specXxx\` block-tag definitions), the parser singleton, the TSDoc-tag ↔ internal-name map, and the byte- accurate body extraction that bypasses TSDoc's content tree (so embedded \`@\`-references and angle-bracketed placeholders in prose bodies survive intact).
- [`__tests__/parser.spec.test.ts`](./__tests__/parser.spec.test.ts) — Property stubs for the JSDoc directive parser. Rejects unknown directives; rejects oversize bodies; the parsed AST matches the closed grammar in \`directives.ts\`. Cross-cutting escape-helper properties live in \`escape.spec.test.ts\`.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `jsdoc-parser-rejects-unknown-directive` | `Exception Raising` | `parseFileDirectives` | unknown \`@spec.\*\` directive names fail with JsDocUnknownDirectiveError on the Effect error channel | implemented |
| `jsdoc-parser-ast-typechecks` | `Typechecking` | `parseFileDirectives` | every parsed directive matches the closed Directive union shape | implemented |
| `jsdoc-parser-enforces-body-cap` | `Constant Bounds Checking` | `parseFileDirectives`, `enforceLengthCap` | directive bodies longer than DIRECTIVE\_BODY\_MAX\_CHARS fail with JsDocDirectiveOverflowError | implemented |
| `parser-rejects-malformed-dotted-spec-tags` | `Exception Raising` | `parseFileDirectives` | \`@spec.foo\_bar\`, \`@spec.foo.bar\`, \`@spec.Type\` (any dotted form the \`\[a-z\]\[a-z-\]\*\` rewriter doesn't normalize) fail with JsDocUnknownDirectiveError; the closed grammar never silently drops a misspelled directive | implemented |
| `parser-bounds-directive-body-at-any-block-tag` | `Constant Equality` | `parseFileDirectives` | a \`@spec.\*\` directive followed by a standard JSDoc block (\`@param\`, \`@returns\`, \`@throws\`, ...) extracts its body only up to that next block tag — no absorption of unrelated comment content into the directive | implemented |
| `parser-accepts-bare-newline-reason-form` | `Inclusion` | `parseFileDirectives` | the multi-line form \`\* \\@spec.guarantee "x"\\n\* reason: y\` (no horizontal whitespace before \`reason:\`) parses successfully — head and reason split exactly as in the inline / indented forms | implemented |
| `parser-binds-member-directives-to-containing-export` | `Constant Equality` | `parseFileDirectives` | a \`@spec.assume\`/\`@spec.guarantee\` JSDoc on an interface method / property signature / class member binds to the enclosing exportable declaration, not the member itself | implemented |
| `parser-routes-aliased-reexport-directives-to-public-name` | `Constant Equality` | `parseFileDirectives` | JSDoc directives on \`foo\` reach the export entry keyed by the public alias \`bar\` when the barrel re-exports as \`export { foo as bar }\`; \`@spec.ignore-export foo\` also drops the aliased export | implemented |
