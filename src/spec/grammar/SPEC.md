---
folder: src/spec/grammar
format-version: 0.1.0
generatedAtSha: 7829cb2b254f3b571b16170c6852602ff2711060
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0.46296296296296297
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

Barrel for `spec/grammar/`. Re-exports the `@spec.*` directive parsers and the closed `PropertyType` vocabulary.

`it-spec.ts` is INTENTIONALLY NOT re-exported here. The runtime encoding of per-export directive metadata (`itSpec.todo` / `itSpec.prop`) imports Vitest's `it`; Vitest's module throws when loaded outside a test runner (e.g. when the `safer-spec` CLI binary is invoked). Re-exporting `itSpec` through this barrel would transitively pull Vitest into every cross-folder consumer of any grammar export (directive parsers, types, PROPERTY_TYPES), crashing the CLI. Tests reach `itSpec` directly via `@safer/spec/grammar/it-spec.js`; the package's main facade (`src/index.ts`) re-exports it for downstream authors.

`SaferSpecExecutionReporter` in `spec/artifact/index.ts` has the same exclusion for the same reason.

## Public surface

### [`DIRECTIVE_BODY_MAX_CHARS`](./shared.ts#L17)

```ts
export const DIRECTIVE_BODY_MAX_CHARS = 500;
```

Trust-boundary cap on directive bodies routed as agent context
(assume / guarantee / residual-contract / skip reasons / per-test
claim).

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
- [`index.ts`](./index.ts) — Barrel for \`spec/grammar/\`. Re-exports the \`@spec.\*\` directive parsers and the closed \`PropertyType\` vocabulary.  \`it-spec.ts\` is INTENTIONALLY NOT re-exported here. The runtime encoding of per-export directive metadata (\`itSpec.todo\` / \`itSpec.prop\`) imports Vitest's \`it\`; Vitest's module throws when loaded outside a test runner (e.g. when the \`safer-spec\` CLI binary is invoked). Re-exporting \`itSpec\` through this barrel would transitively pull Vitest into every cross-folder consumer of any grammar export (directive parsers, types, PROPERTY\_TYPES), crashing the CLI. Tests reach \`itSpec\` directly via \`@safer/spec/grammar/it-spec.js\`; the package's main facade (\`src/index.ts\`) re-exports it for downstream authors.  \`SaferSpecExecutionReporter\` in \`spec/artifact/index.ts\` has the same exclusion for the same reason.
- [`it-spec.ts`](./it-spec.ts) — Author-facing test helper. Terminal domain — \`itSpec\` is the public surface every spec author imports to declare property stubs. Wraps Vitest's \`it.todo\` and \`it.prop\` so authors get typed \`(id, opts, arb, body)\` ergonomics, AND the codemod can read property metadata back from each call site at codemod time.  Every \`itSpec.prop\`/\`itSpec.todo\` call carries four required JSDoc directives above it (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`). \`generate\` walks \`\*.spec.test.ts\` files, parses these directives, and emits the colocated SPEC.md \`## Properties\` table from the tests. The runtime \`meta\` argument carries the same metadata for \`validate --implemented\` to cross-check JSDoc against runtime opts.  \`prop\` additionally attaches the fast-check \`RunDetails\` (numRuns, numSkips) to the Vitest task's \`meta.fastCheck\` slot so the execution reporter at \`spec/reporter.ts\` can aggregate per-folder coverage stats into the per-folder \`.safer-spec/&lt;slug&gt;.execution.json\` artifact validate decodes through its co-located Schema.
- [`per-export.ts`](./per-export.ts) — Per-export directives — \`@spec.assume\`, \`@spec.guarantee\`, \`@spec.residual-contract\`, \`@spec.skip\`, \`@spec.ignore-export\`. These attach to public-surface exported declarations; the parser records the declaration's name in \`location.exportName\`. Each directive in this population carries a required \`reason:\` line.
- [`per-test.ts`](./per-test.ts) — Per-test directives — \`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`. These attach above each \`itSpec.prop\`/\`itSpec.todo\` call site; the parser records \`location.exportName\` as \`null\`.
- [`property-types.ts`](./property-types.ts) — Closed taxonomy of property assertion types. Terminal domain — no upward dependencies.  The 9 OOPSLA-significant property types (Roundtrip, Inclusion, Exception Raising, …). Source: Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered to the 9 statistically significant ones. Dropped: Generated-Expression Bounds Checking (p=0.0627), Generated-Expression Non-Equality (p=0.3299), Constant Inclusion (p=0.8969).  The codemod assumes ALL property types apply to every export by default. Opting out is explicit via per-export \`@spec.skip "&lt;PropertyType&gt;" reason: &lt;why&gt;\` directives. There is no built-in matrix mapping export shapes to required property types — that prescription belongs in the author's \`@spec.skip\` reasons, not in the tool.  Per-repo extension via \`safer-spec.config.ts\` \`propertyTypesExtension: PropertyType\[\]\`.
- [`shared.ts`](./shared.ts) — Shared infrastructure for the per-population directive modules: size caps, the \`ParseError\` union, the three tagged errors the parser can emit, and the small string helpers each population uses (unquote, splitReason).
- [`tsdoc-bridge.ts`](./tsdoc-bridge.ts) — \`@microsoft/tsdoc\` adapter layer. Owns the TSDoc configuration (closed set of \`@specXxx\` block-tag definitions), the parser singleton, the TSDoc-tag ↔ internal-name map, and the byte- accurate body extraction that bypasses TSDoc's content tree (so embedded \`@\`-references and angle-bracketed placeholders in prose bodies survive intact).
- [`__tests__/grammar.spec.test.ts`](./__tests__/grammar.spec.test.ts) — Property tests for \`spec/grammar/\`'s exports beyond the directive parser. \`parser.spec.test.ts\` covers \`parseFileDirectives\` end-to-end; this file covers the supporting surface — the \`DIRECTIVE\_BODY\_MAX\_CHARS\` constant, the closed \`PROPERTY\_TYPES\` vocabulary, and the three JsDoc directive tagged-error classes.
- [`__tests__/parser.spec.test.ts`](./__tests__/parser.spec.test.ts) — Property stubs for the JSDoc directive parser. Rejects unknown directives; rejects oversize bodies; the parsed AST matches the closed grammar in \`directives.ts\`. Cross-cutting escape-helper properties live in \`escape.spec.test.ts\`.
- [`__tests__/sweep.spec.test.ts`](./__tests__/sweep.spec.test.ts) — Coverage-sweep tests for \`spec/grammar/\`. Adds property types beyond the dedicated \`parser.spec.test.ts\` (parseFileDirectives) and \`grammar.spec.test.ts\` (constants + error classes) — covers the Typechecking / Constant Bounds Checking / Inclusion residue per export so the per-folder coverage gate has room.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `directive-body-max-chars-is-500` | `Constant Equality` | `DIRECTIVE\_BODY\_MAX\_CHARS` | the directive body length cap is exactly 500 — the contract every \`@spec.\*\` directive's body length is checked against; downstream agents that wrote large prose blocks would silently truncate without this | implemented |
| `directive-body-max-chars-positive-int` | `Constant Bounds Checking` | `DIRECTIVE\_BODY\_MAX\_CHARS` | the cap is a positive integer — the body-length check against \`body.length &gt; cap\` would short-circuit incorrectly with a zero or negative cap | implemented |
| `property-types-tuple-has-typechecking-kind` | `Typechecking` | `PROPERTY\_TYPES` | \`PROPERTY\_TYPES\` is a readonly array of non-empty strings — the type-coverage divisor + the \`@spec.type\` vocabulary literal-union derives from this tuple | implemented |
| `jsdoc-overflow-error-roundtrips-payload` | `Constant Equality` | `JsDocDirectiveOverflowError` | a \`JsDocDirectiveOverflowError\` exposes the \`{path, line, directive, length, limit}\` payload it was constructed with — the body the validate diagnostic reads to point the user at the call site | implemented |
| `jsdoc-parse-error-tag-stable` | `Constant Equality` | `JsDocDirectiveParseError` | every \`JsDocDirectiveParseError\` instance carries \`\_tag === "JsDocDirectiveParseError"\` — the discriminant validate-checks routes on | implemented |
| `jsdoc-unknown-error-is-throwable` | `Exception Raising` | `JsDocUnknownDirectiveError` | \`JsDocUnknownDirectiveError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` without payload loss — the surface validate uses to translate \`@spec.foo\` (unknown tags) into stub-tier exits | implemented |
| `jsdoc-parser-rejects-unknown-directive` | `Exception Raising` | `parseFileDirectives` | unknown \`@spec.\*\` directive names fail with JsDocUnknownDirectiveError on the Effect error channel | implemented |
| `jsdoc-parser-ast-typechecks` | `Typechecking` | `parseFileDirectives` | every parsed directive matches the closed Directive union shape | implemented |
| `jsdoc-parser-enforces-body-cap` | `Constant Bounds Checking` | `parseFileDirectives`, `enforceLengthCap` | directive bodies longer than DIRECTIVE\_BODY\_MAX\_CHARS fail with JsDocDirectiveOverflowError | implemented |
| `parser-rejects-malformed-dotted-spec-tags` | `Exception Raising` | `parseFileDirectives` | \`@spec.foo\_bar\`, \`@spec.foo.bar\`, \`@spec.Type\` (any dotted form the \`\[a-z\]\[a-z-\]\*\` rewriter doesn't normalize) fail with JsDocUnknownDirectiveError; the closed grammar never silently drops a misspelled directive | implemented |
| `parser-bounds-directive-body-at-any-block-tag` | `Constant Equality` | `parseFileDirectives` | a \`@spec.\*\` directive followed by a standard JSDoc block (\`@param\`, \`@returns\`, \`@throws\`, ...) extracts its body only up to that next block tag — no absorption of unrelated comment content into the directive | implemented |
| `parser-accepts-bare-newline-reason-form` | `Inclusion` | `parseFileDirectives` | the multi-line form \`\* \\@spec.guarantee "x"\\n\* reason: y\` (no horizontal whitespace before \`reason:\`) parses successfully — head and reason split exactly as in the inline / indented forms | implemented |
| `parser-binds-member-directives-to-containing-export` | `Constant Equality` | `parseFileDirectives` | a \`@spec.assume\`/\`@spec.guarantee\` JSDoc on an interface method / property signature / class member binds to the enclosing exportable declaration, not the member itself | implemented |
| `parser-routes-aliased-reexport-directives-to-public-name` | `Constant Equality` | `parseFileDirectives` | JSDoc directives on \`foo\` reach the export entry keyed by the public alias \`bar\` when the barrel re-exports as \`export { foo as bar }\`; \`@spec.ignore-export foo\` also drops the aliased export | implemented |
| `directive-body-max-chars-typechecks-as-number` | `Typechecking` | `DIRECTIVE\_BODY\_MAX\_CHARS` | \`DIRECTIVE\_BODY\_MAX\_CHARS\` is a \`number\` literal — the typed const directive parsers compare body lengths against | implemented |
| `directive-body-max-chars-bounded-range` | `Inclusion` | `DIRECTIVE\_BODY\_MAX\_CHARS` | the cap sits in the practical range 100..2000 — caps below 100 disable expressive prose; caps above 2000 invite an editor-window-breaking diagnostic that authors won't read | implemented |
| `property-types-bounded-by-paper-rounding` | `Constant Bounds Checking` | `PROPERTY\_TYPES` | \`PROPERTY\_TYPES.length\` stays in 8..12 — the OOPSLA paper's 9-category vocabulary is the documented target; future per-repo extensions append a few more, never reduce | implemented |
| `property-types-no-empty-entries` | `Constant Non-Equality` | `PROPERTY\_TYPES` | no entry is empty or whitespace-only — every member is a renderable label the SPEC.md \`## Properties\` table uses verbatim | implemented |
| `property-types-roundtrip-through-set` | `Roundtrip` | `PROPERTY\_TYPES` | \`\[...new Set(PROPERTY\_TYPES)\].length === PROPERTY\_TYPES.length\` — the tuple already deduplicates; Set construction is a no-op (no dropped members) | implemented |
| `jsdoc-overflow-error-typechecks-as-error` | `Typechecking` | `JsDocDirectiveOverflowError` | \`JsDocDirectiveOverflowError\` instances extend native \`Error\` — the runtime contract Effect's exit-cause renderer expects | implemented |
| `jsdoc-overflow-error-is-throwable` | `Exception Raising` | `JsDocDirectiveOverflowError` | \`JsDocDirectiveOverflowError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` — the stub-tier diagnostic catchDirectiveErrors translates | implemented |
| `jsdoc-overflow-error-bounded-payload` | `Constant Bounds Checking` | `JsDocDirectiveOverflowError` | every constructed instance has \`length &gt; limit\` numerically — the precondition for an overflow diagnosis to make sense | implemented |
| `jsdoc-parse-error-typechecks-as-error` | `Typechecking` | `JsDocDirectiveParseError` | \`JsDocDirectiveParseError\` instances extend \`Error\` and expose \`\_tag\`, \`path\`, \`line\`, \`directive\`, \`reason\` strings/numbers | implemented |
| `jsdoc-parse-error-is-throwable` | `Exception Raising` | `JsDocDirectiveParseError` | \`JsDocDirectiveParseError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` — the stub-tier diagnostic the validate gate routes via catchDirectiveErrors | implemented |
| `jsdoc-parse-error-roundtrips-payload` | `Roundtrip` | `JsDocDirectiveParseError` | payload fields roundtrip through the constructor — the surface validate's stub-tier diagnostic reads | implemented |
| `jsdoc-unknown-error-typechecks-as-error` | `Typechecking` | `JsDocUnknownDirectiveError` | instances extend \`Error\` with \`\_tag === "JsDocUnknownDirectiveError"\` and a string \`directive\` field naming the offending tag | implemented |
| `jsdoc-unknown-error-roundtrips-payload` | `Roundtrip` | `JsDocUnknownDirectiveError` | the \`{path, line, directive}\` payload roundtrips through the constructor — the routing surface validate's stub-tier diagnostic depends on | implemented |
| `jsdoc-unknown-error-constant-tag` | `Constant Equality` | `JsDocUnknownDirectiveError` | every instance carries \`\_tag === "JsDocUnknownDirectiveError"\` — the discriminant \`catchDirectiveErrors\` routes on | implemented |
