---
folder: src/spec
format-version: 0.1.0
generatedAtSha: 9eb391a9b92929aac4e8b3746d1a62a787e54219
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0
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

Spec domain barrel. Anchors `src/spec/SPEC.md` (codemod requires every folder with a SPEC to expose an `index.ts` barrel) and re-exports the test-author surface (`itSpec`, `ItSpec`) consumed by the package facade. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by `commands/` via path aliases; routing it through this barrel would be ceremony without a caller.

## Public surface

### [`ItSpec`](./it-spec.ts#L25)

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
   * @spec.guarantee "registers a fast-check property under `id` that runs `body` against samples drawn from `arb`"
   *   reason: side-effect contract; runtime registration with Vitest.
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

### [`itSpec`](./it-spec.ts#L56)

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
    // eslint-disable-next-line sonarjs/assertions-in-tests -- fc.assert IS the assertion; sonarjs only recognizes expect/chai/jest patterns
    it(id, () => fc.assert(property));
  },
};
```

## Children

- [`directives/`](./directives/SPEC.md) — Directive grammar entry point. Walks TypeScript source via ts-morph and dispatches each parsed TSDoc block (via \`tsdoc-bridge\`) to its per-population parser. Returns the typed \`LocatedDirective\` stream.  The population modules (\`file-level\`, \`per-export\`, \`per-test\`) co-locate each directive's Schema with its parse function. The \`tsdoc-bridge\` module owns the TSDoc configuration and the byte-accurate body extraction.
- [`emit.ts`](./emit.ts) — Canonical SPEC.md serializer + \`SpecArtifact\` builder. Emits the \`SpecFrontmatter\`-shaped block and the typed sidecar value from a \`FolderAnalysis\` + \`SpecMeta\`. Canonical form: LF endings, lex-sort for file lists, source-order for exports; re-emission is byte-identical.
- [`escape.ts`](./escape.ts) — Escape directive body content for safe emission into Markdown, YAML frontmatter, and JSON sidecars. Defuses prompt-injection vectors via residual-contract strings that downstream agents will read as context.  Co-located with the directive grammar (\`directives.ts\`) since \`enforceLengthCap\` shares the cap constant and emits the same overflow error class. The four escape functions are exported as the spec domain's emit-time sanitization boundary.
- [`frontmatter.ts`](./frontmatter.ts) — SPEC.md frontmatter contract — Effect Schema for the YAML block emitted at the top of each generated SPEC.md. Coverage fields are nullable for \`--planned\` state where classifier and precondition numbers are not yet observable.  Schema constructor is private to this module; the public boundary is \`decodeSpecFrontmatter\` (decode unknown YAML output into the typed shape).
- [`index.ts`](./index.ts) — Spec domain barrel. Anchors \`src/spec/SPEC.md\` (codemod requires every folder with a SPEC to expose an \`index.ts\` barrel) and re-exports the test-author surface (\`itSpec\`, \`ItSpec\`) consumed by the package facade. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by \`commands/\` via path aliases; routing it through this barrel would be ceremony without a caller.
- [`it-spec.ts`](./it-spec.ts) — Author-facing test helper. Terminal domain — \`itSpec\` is the public surface every spec author imports to declare property stubs. Wraps Vitest's \`it.todo\` and \`it.prop\` so authors get typed \`(id, opts, arb, body)\` ergonomics, AND the codemod can read property metadata back from each call site at codemod time.  Every \`itSpec.prop\`/\`itSpec.todo\` call carries four required JSDoc directives above it (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`). \`generate\` walks \`\*.spec.test.ts\` files, parses these directives, and emits the colocated SPEC.md \`## Properties\` table from the tests. The runtime \`meta\` argument carries the same metadata for \`validate --implemented\` to cross-check JSDoc against runtime opts.
- [`link-resolver.ts`](./link-resolver.ts) — Resolves backticked symbol references in SPEC.md body prose. Local source references use declaration locations; workspace references can resolve to sibling SPEC.md anchors. Cross-file source resolution is a separate resolver capability.  Tagged error \`LinkResolutionError\` is co-located here.  Resolution strategy is heuristic over the symbol shape: - Identifier starting with \`@safer/\` → \`cross-spec\` (sibling spec folder anchor). - Identifier matching the npm-package shape (\`@scope/name\` / lowercase package) → \`external-package\` (returns \`UnresolvedExternal\`, no failure). - Identifier matching \`agent-code-guard/\*\` → \`agent-code-guard-rule\`. - Everything else → \`intra-file\` (local declaration).  The resolver classifies by shape only; it does NOT walk the AST. The build-time \`validate\` gate is responsible for fail-closed checking that intra-file symbols actually exist; this resolver returns the \`LinkResolution\` so the emit step can stamp an anchor.
- [`sidecar-writer.ts`](./sidecar-writer.ts) — Writes \`.safer-spec/&lt;folder&gt;.json\` sidecar files. Sanitizes every string field on emit (size cap + escape) at the sidecar trust boundary.  Tagged error \`SidecarWriteError\` is co-located here (this is the file that emits it via Effect.fail on filesystem failures).  \`serializeSidecar\` encodes a \`SpecArtifact\` through the canonical Schema constructor (private to \`sidecar.ts\`), producing a JSON string with a trailing newline. \`writeSidecar\` writes that JSON to \`.safer-spec/&lt;folder-slug&gt;.json\`, creating the directory on first run.
- [`sidecar.ts`](./sidecar.ts) — Sidecar JSON contract — the canonical artifact for LLM-agent consumption. Markdown SPEC.md is for humans; the sidecar is for tools. The Schema constructor stays private; \`decodeSpecArtifact\` is the public boundary.  Tagged error \`SidecarSchemaError\` is co-located here (it is emitted by the sidecar domain — both the decode boundary and the writer raise it on shape violations).
- [`source-exports.ts`](./source-exports.ts) — Walks a TypeScript source file via ts-morph and returns the list of exported declaration names plus their source lines. Used by \`generate.ts\` to build the SPEC.md \`## Public surface\` rows and match per-export \`@spec\*\` directives to their declarations.  \`collectExports\` accepts sibling source files + tsconfig \`paths\` via \`CollectExportsOptions\` so it can follow barrel re-exports across files and aliases. The caller (commands/validate-pipeline.ts's \`loadProjectContext\`) supplies that input.
- [`todos.ts`](./todos.ts) — Walks \`\*.spec.test.ts\` source via ts-morph and extracts each \`itSpec.todo\` / \`itSpec.prop\` call site plus the four Amendment-6 directives (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`) that should immediately precede it.  Per-test directives bind to the JSDoc block IMMEDIATELY preceding the call (via ts-morph's \`Statement.getJsDocs()\` on the call's enclosing statement); the previous "closest earlier" search across the whole file silently inherited directives from unrelated blocks.  Returns rows for downstream emit + an \`issues\` list. Issues are surfaced to \`validate\` as MissingStub / MissingSpecProperty / MissingImpl gap errors with stable exit codes.
- [`__tests__/emit.spec.test.ts`](./__tests__/emit.spec.test.ts) — Property stubs for the canonical SPEC.md section emitter. Roundtrip: parse→serialize→parse stays stable. Inclusion: every section in the emitted output is present.
- [`__tests__/frontmatter.spec.test.ts`](./__tests__/frontmatter.spec.test.ts) — Property stubs for the SPEC.md frontmatter contract. Tests reference the public \`decodeSpecFrontmatter\` boundary; the underlying Schema constructor stays private to spec/frontmatter.ts.
- [`__tests__/link-resolver.spec.test.ts`](./__tests__/link-resolver.spec.test.ts) — Property stubs for the link resolver. Inclusion: intra-file and cross-spec references resolve to valid hrefs. Cross-file source resolution is a separate resolver capability.
- [`__tests__/parser.spec.test.ts`](./__tests__/parser.spec.test.ts) — Property stubs for the JSDoc directive parser and its escape-on-emit helpers. Rejects unknown directives; rejects oversize bodies; the parsed AST matches the closed grammar in \`directives.ts\`; escape helpers preserve safe substitution into Markdown / YAML / JSON.
- [`__tests__/sidecar-writer.spec.test.ts`](./__tests__/sidecar-writer.spec.test.ts) — Property stubs for the sidecar writer. Roundtrip: written JSON decodes back to the same SpecArtifact value. Trust-boundary: every string field is escape-on-emit.
- [`__tests__/sidecar.spec.test.ts`](./__tests__/sidecar.spec.test.ts) — Property stubs for the sidecar JSON contract. Roundtrip covers encode/decode stability; Exception Raising covers malformed input; Typechecking verifies that decoded data matches the declared type.  Tests reference the public \`decodeSpecArtifact\` boundary; the underlying Schema constructor stays private to spec/sidecar.ts.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `emit-sha-stable` | `Roundtrip` | `emitMarkdown` | two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha | todo |
| `emit-section-order-fixed` | `Inclusion` | `emitMarkdown` | emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture | todo |
| `emit-canonical-line-endings` | `Constant Equality` | `emitMarkdown` | emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed | todo |
| `emit-frontmatter-roundtrips` | `Roundtrip` | `emitMarkdown` | YAML frontmatter parsed from emitMarkdown output round-trips back to the same SpecFrontmatter shape | todo |
| `emit-public-surface-source-order` | `Inclusion` | `emitMarkdown` | Public surface section lists exports in source-order (matching the file's declaration order) | todo |
| `emit-files-section-lex-sorted` | `Inclusion` | `emitMarkdown` | Files section lists sibling filenames in lexicographic order | todo |
| `emit-residual-bodies-escaped` | `Constant Bounds Checking` | `emitMarkdown` | residual-contract bodies emitted into markdown go through escapeForMarkdown; no injection | todo |
| `frontmatter-roundtrip` | `Roundtrip` | `decodeSpecFrontmatter` | YAML emit(decode(yaml)) is byte-equal to the original well-formed yaml frontmatter block | todo |
| `frontmatter-rejects-malformed` | `Exception Raising` | `decodeSpecFrontmatter` | malformed YAML fails on the Effect error channel with a typed ParseError, never throws | todo |
| `frontmatter-decoded-shape` | `Typechecking` | `decodeSpecFrontmatter` | decoded frontmatter matches the declared SpecFrontmatter type at every branch | todo |
| `link-resolver-intra-file-anchor-pinned` | `Inclusion` | `resolveSymbol` | every intra-file resolution returns href with a non-null sha-pinned anchor | todo |
| `link-resolver-fails-internal-misses` | `Exception Raising` | `resolveSymbol` | unresolved internal references fail with LinkResolutionError; external misses return UnresolvedExternal | todo |
| `jsdoc-parser-rejects-unknown-directive` | `Exception Raising` | `parseFileDirectives` | unknown \`@spec.\*\` directive names fail with JsDocUnknownDirectiveError on the Effect error channel | todo |
| `jsdoc-parser-ast-typechecks` | `Typechecking` | `parseFileDirectives` | every parsed directive matches the closed Directive union shape | todo |
| `jsdoc-parser-enforces-body-cap` | `Constant Bounds Checking` | `parseFileDirectives`, `enforceLengthCap` | directive bodies longer than DIRECTIVE\_BODY\_MAX\_CHARS fail with JsDocDirectiveOverflowError | todo |
| `jsdoc-escape-markdown-safe` | `Constant Bounds Checking` | `escapeForMarkdown` | escaped output never introduces new markdown syntactic structure (backticks, code-fences, link syntax) | todo |
| `jsdoc-escape-yaml-safe` | `Constant Bounds Checking` | `escapeForYaml` | escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes) | todo |
| `jsdoc-escape-json-safe` | `Constant Bounds Checking` | `escapeForJson` | escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars) | todo |
| `sidecar-writer-roundtrip` | `Roundtrip` | `serializeSidecar`, `decodeSpecArtifact` | decode(parse(serialize(artifact))) returns the original artifact at every well-formed input | todo |
| `sidecar-writer-atomic-on-failure` | `Exception Raising` | `writeSidecar` | partial sidecars are not left on disk on filesystem failures | todo |
| `sidecar-roundtrip` | `Roundtrip` | `decodeSpecArtifact` | encode(decode(json)) is byte-equal to the original well-formed json | todo |
| `sidecar-rejects-malformed` | `Exception Raising` | `decodeSpecArtifact` | malformed input fails on the Effect error channel with a typed ParseError, never throws | todo |
| `sidecar-decoded-shape` | `Typechecking` | `decodeSpecArtifact` | decoded artifact matches the declared SpecArtifact type at every branch of the union | todo |
