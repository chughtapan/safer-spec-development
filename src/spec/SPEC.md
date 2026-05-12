---
folder: src/spec
format-version: 0.1.0
generatedAtSha: b7958e2af7627dd6cb9ae013ada82e29e0c5def9
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

Spec domain barrel. Anchors `src/spec/SPEC.md` (codemod requires every folder with a SPEC to expose an `index.ts` barrel) and re-exports the test-author surface (`itSpec`, `ItSpec`) consumed by the package facade. The Vitest reporter class is exposed via the dedicated `@chughtapan/safer-spec-development/reporter` subpath (not this barrel) so config-time consumers don't transitively load `it-spec.ts`'s `vitest` import, which throws when evaluated from a config file. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by `commands/` via path aliases; routing it through this barrel would be ceremony without a caller.

## Public surface

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

## Children

- [`directives/`](./directives/SPEC.md) — Directive grammar entry point. Walks TypeScript source via ts-morph and dispatches each parsed TSDoc block (via \`tsdoc-bridge\`) to its per-population parser. Returns the typed \`LocatedDirective\` stream.  The population modules (\`file-level\`, \`per-export\`, \`per-test\`) co-locate each directive's Schema with its parse function. The \`tsdoc-bridge\` module owns the TSDoc configuration and the byte-accurate body extraction.
- [`emit.ts`](./emit.ts) — Canonical SPEC.md serializer + \`SpecArtifact\` builder. Emits the \`SpecFrontmatter\`-shaped block and the typed sidecar value from a \`FolderAnalysis\` + \`SpecMeta\`. Canonical form: LF endings, lex-sort for file lists, source-order for exports; re-emission is byte-identical.
- [`escape.ts`](./escape.ts) — Escape directive body content for safe emission into Markdown, YAML frontmatter, and JSON sidecars. Defuses prompt-injection vectors via residual-contract strings that downstream agents will read as context.  Co-located with the directive grammar (\`directives.ts\`) since \`enforceLengthCap\` shares the cap constant and emits the same overflow error class. The four escape functions are exported as the spec domain's emit-time sanitization boundary. Each function's own \`@spec.guarantee\` documents its surface-specific safety claim.
- [`frontmatter.ts`](./frontmatter.ts) — SPEC.md frontmatter contract — Effect Schema for the YAML block emitted at the top of each generated SPEC.md. Coverage fields are nullable for \`--planned\` state where classifier and precondition numbers are not yet observable.  Schema constructor is private to this module; the public boundary is \`decodeSpecFrontmatter\` (decode unknown YAML output into the typed shape). Shape and refinements are captured by Effect Schema — no residual contract beyond the schema is in scope here.
- [`index.ts`](./index.ts) — Spec domain barrel. Anchors \`src/spec/SPEC.md\` (codemod requires every folder with a SPEC to expose an \`index.ts\` barrel) and re-exports the test-author surface (\`itSpec\`, \`ItSpec\`) consumed by the package facade. The Vitest reporter class is exposed via the dedicated \`@chughtapan/safer-spec-development/reporter\` subpath (not this barrel) so config-time consumers don't transitively load \`it-spec.ts\`'s \`vitest\` import, which throws when evaluated from a config file. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by \`commands/\` via path aliases; routing it through this barrel would be ceremony without a caller.
- [`it-spec.ts`](./it-spec.ts) — Author-facing test helper. Terminal domain — \`itSpec\` is the public surface every spec author imports to declare property stubs. Wraps Vitest's \`it.todo\` and \`it.prop\` so authors get typed \`(id, opts, arb, body)\` ergonomics, AND the codemod can read property metadata back from each call site at codemod time.  Every \`itSpec.prop\`/\`itSpec.todo\` call carries four required JSDoc directives above it (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`). \`generate\` walks \`\*.spec.test.ts\` files, parses these directives, and emits the colocated SPEC.md \`## Properties\` table from the tests. The runtime \`meta\` argument carries the same metadata for \`validate --implemented\` to cross-check JSDoc against runtime opts.  \`prop\` additionally attaches the fast-check \`RunDetails\` (numRuns, numSkips) to the Vitest task's \`meta.fastCheck\` slot so the execution reporter at \`spec/reporter.ts\` can aggregate per-folder coverage stats into the per-folder \`.safer-spec/&lt;slug&gt;.execution.json\` artifact validate decodes through its co-located Schema.
- [`link-resolver.ts`](./link-resolver.ts) — Resolves backticked symbol references in SPEC.md body prose. Local source references use declaration locations; workspace references can resolve to sibling SPEC.md anchors. Cross-file source resolution is a separate resolver capability.  Tagged error \`LinkResolutionError\` is co-located here.  Resolution strategy is heuristic over the symbol shape: - Identifier starting with \`@safer/\` → \`cross-spec\` (sibling spec folder anchor). - Identifier matching the npm-package shape (\`@scope/name\` / lowercase package) → \`external-package\` (returns \`UnresolvedExternal\`, no failure). - Identifier matching \`agent-code-guard/\*\` → \`agent-code-guard-rule\`. - Everything else → \`intra-file\` (local declaration).  The resolver classifies by shape only; it does NOT walk the AST. The build-time \`validate\` gate is responsible for fail-closed checking that intra-file symbols actually exist; this resolver returns the \`LinkResolution\` so the emit step can stamp an anchor.  Unresolved internal references resolve to \`intra-file\` placeholders that the validate gate inspects; unresolved external references return \`UnresolvedExternal\` (no failure). Per-export guarantees are on the individual exports below.
- [`reporter.ts`](./reporter.ts) — Vitest reporter that emits per-folder execution sidecars. Walks the file/task tree at \`onFinished\`, extracts the fast-check stats attached to each \`itSpec.prop\` call's \`task.meta.fastCheck\` slot, aggregates by enclosing folder (\`folder/\_\_tests\_\_/x.spec.test.ts\` is credited to \`folder\`), and writes \`folder/.safer-spec/slug.execution.json\`.  Boundary: Vitest's File/Task shape carries arbitrary user metadata; each task's \`meta.fastCheck\` goes through \`FastCheckTaskStatsSchema\` and the final sidecar through \`ExecutionSidecarSchema\` so validate can decode the on-disk artifact without trust assumptions.  \`SaferSpecExecutionReporter\` is the Vitest-facing class. validate's \`--implemented\` mode reads the emitted sidecar via \`decodeExecutionSidecar\`. The reporter composes its own \`NodeContext.layer\` because Vitest invokes it outside the codemod CLI's composition root, so this file owns its runtime boundary.
- [`sidecar-writer.ts`](./sidecar-writer.ts) — Writes \`.safer-spec/&lt;folder&gt;.json\` sidecar files. Sanitizes every string field on emit (size cap + escape) at the sidecar trust boundary.  Tagged error \`SidecarWriteError\` is co-located here (this is the file that emits it via Effect.fail on filesystem failures).  \`serializeSidecar\` encodes a \`SpecArtifact\` through the canonical Schema constructor (private to \`sidecar.ts\`), producing a JSON string with a trailing newline. \`writeSidecar\` writes that JSON to \`.safer-spec/&lt;folder-slug&gt;.json\`, creating the directory on first run. Output JSON roundtrips through \`decodeSpecArtifact\`; the roundtrip property is enforced in the sidecar domain's \`\_\_tests\_\_/\`. Per- export guarantees are on the individual exports below.
- [`sidecar.ts`](./sidecar.ts) — Sidecar JSON contract — the canonical artifact for LLM-agent consumption. Markdown SPEC.md is for humans; the sidecar is for tools. The Schema constructor stays private; \`decodeSpecArtifact\` is the public boundary.  Tagged error \`SidecarSchemaError\` is co-located here (it is emitted by the sidecar domain — both the decode boundary and the writer raise it on shape violations). All string fields are size-capped and escape-on-emit (no prompt injection through residual contracts) — directive bodies are user-controlled JSDoc and agents read this JSON as downstream execution context. Per-export guarantees are on the individual exports below.
- [`source-exports.ts`](./source-exports.ts) — Walks a TypeScript source file via ts-morph and returns the list of exported declaration names plus their source lines. Used by \`generate.ts\` to build the SPEC.md \`## Public surface\` rows and match per-export \`@spec\*\` directives to their declarations.  \`collectExports\` accepts sibling source files + tsconfig \`paths\` via \`CollectExportsOptions\` so it can follow barrel re-exports across files and aliases. The caller (commands/validate-pipeline.ts's \`loadProjectContext\`) supplies that input.
- [`todos.ts`](./todos.ts) — Walks \`\*.spec.test.ts\` source via ts-morph and extracts each \`itSpec.todo\` / \`itSpec.prop\` call site plus the four Amendment-6 directives (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`) that should immediately precede it.  Per-test directives bind to the JSDoc block IMMEDIATELY preceding the call (via ts-morph's \`Statement.getJsDocs()\` on the call's enclosing statement); the previous "closest earlier" search across the whole file silently inherited directives from unrelated blocks.  Returns rows for downstream emit + an \`issues\` list. Issues are surfaced to \`validate\` as MissingStub / MissingSpecProperty / MissingImpl gap errors with stable exit codes.
- [`__tests__/emit-children.spec.test.ts`](./__tests__/emit-children.spec.test.ts) — Property stubs for the SPEC.md \`## Children\` section and the per-file rendering invariants. Splits out of \`emit.spec.test.ts\` to stay under the per-file line cap; both files cover \`emitMarkdown\`.
- [`__tests__/emit.spec.test.ts`](./__tests__/emit.spec.test.ts) — Property stubs for the canonical SPEC.md section emitter. Covers section ordering, line-ending canonicalization, roundtrip through frontmatter decode, lex-sort guarantees, and code-span safety. Children-section + per-file rendering properties live in \`emit-children.spec.test.ts\`.
- [`__tests__/escape.spec.test.ts`](./__tests__/escape.spec.test.ts) — Property stubs for the escape-on-emit helpers. Each helper defuses a different injection vector: markdown, YAML, JSON. The directive-grammar parser shares this domain because the body-length cap on directives and the escape helpers both live in \`spec/escape.ts\`.
- [`__tests__/frontmatter.spec.test.ts`](./__tests__/frontmatter.spec.test.ts) — Property stubs for the SPEC.md frontmatter contract. Tests reference the public \`decodeSpecFrontmatter\` boundary; the underlying Schema constructor stays private to spec/frontmatter.ts.
- [`__tests__/link-resolver.spec.test.ts`](./__tests__/link-resolver.spec.test.ts) — Property stubs for the link resolver. Inclusion: intra-file and cross-spec references resolve to valid hrefs. Cross-file source resolution is a separate resolver capability.
- [`__tests__/parser.spec.test.ts`](./__tests__/parser.spec.test.ts) — Property stubs for the JSDoc directive parser. Rejects unknown directives; rejects oversize bodies; the parsed AST matches the closed grammar in \`directives.ts\`. Cross-cutting escape-helper properties live in \`escape.spec.test.ts\`.
- [`__tests__/sidecar-writer.spec.test.ts`](./__tests__/sidecar-writer.spec.test.ts) — Property stubs for the sidecar writer. Roundtrip: written JSON decodes back to the same SpecArtifact value. Trust-boundary: every string field is escape-on-emit.
- [`__tests__/sidecar.spec.test.ts`](./__tests__/sidecar.spec.test.ts) — Property stubs for the sidecar JSON contract. Roundtrip covers encode/decode stability; Exception Raising covers malformed input; Typechecking verifies that decoded data matches the declared type.  Tests reference the public \`decodeSpecArtifact\` boundary; the underlying Schema constructor stays private to spec/sidecar.ts.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `emit-children-section-mixes-subfolders-files-tests` | `Inclusion` | `emitMarkdown` | \`## Children\` lists immediate SPEC'd subfolders (linking to \`&lt;sub&gt;/SPEC.md\`) before source files before tests; each row carries the file or subfolder \`@spec.purpose\` body when present | implemented |
| `emit-root-folder-spec-links-stay-in-repo` | `Constant Equality` | `emitMarkdown` | a SPEC.md at the repo root (\`folder === "."\`) reaches every file via \`./&lt;target&gt;\`; \`relativeToFolder\` never emits \`../...\` for the root sentinel | implemented |
| `emit-properties-table-cells-are-code-span-safe` | `Constant Bounds Checking` | `emitMarkdown` | a backtick (or other markdown markup) inside a property \`id\` / \`exports\` cell never closes the surrounding code span; the table grammar (column count, row terminator) survives any author-controlled directive content | implemented |
| `emit-file-purpose-rendered-with-link` | `Inclusion` | `emitMarkdown` | every entry in \`## Children\` for a file with a top-of-file \`@spec.purpose\` renders as \`\[\\\`&lt;rel-path&gt;\\\`\](./&lt;rel-path&gt;) — &lt;purpose body&gt;\`; files without \`@spec.purpose\` render as link-only | implemented |
| `emit-sha-stable` | `Roundtrip` | `emitMarkdown` | two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha | implemented |
| `emit-section-order-fixed` | `Inclusion` | `emitMarkdown` | emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture | implemented |
| `emit-canonical-line-endings` | `Constant Equality` | `emitMarkdown` | emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed | implemented |
| `emit-frontmatter-roundtrips` | `Roundtrip` | `emitMarkdown` | YAML frontmatter parsed from emitMarkdown output round-trips back to the same SpecFrontmatter shape | implemented |
| `emit-public-surface-source-order` | `Inclusion` | `emitMarkdown` | Public surface section lists exports in source-order (matching the file's declaration order) | implemented |
| `emit-files-section-lex-sorted` | `Inclusion` | `emitMarkdown` | Files section lists sibling filenames in lexicographic order | implemented |
| `emit-residual-bodies-escaped` | `Constant Bounds Checking` | `emitMarkdown` | residual-contract bodies emitted into markdown go through escapeForMarkdown; no injection | implemented |
| `jsdoc-escape-markdown-safe` | `Constant Bounds Checking` | `escapeForMarkdown` | escaped output never introduces new markdown syntactic structure (backticks, code-fences, link syntax) | implemented |
| `jsdoc-escape-yaml-safe` | `Constant Bounds Checking` | `escapeForYaml` | escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes) | implemented |
| `jsdoc-escape-json-safe` | `Constant Bounds Checking` | `escapeForJson` | escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars) | implemented |
| `frontmatter-roundtrip` | `Roundtrip` | `decodeSpecFrontmatter` | YAML emit(decode(yaml)) is byte-equal to the original well-formed yaml frontmatter block | implemented |
| `frontmatter-rejects-malformed` | `Exception Raising` | `decodeSpecFrontmatter` | malformed YAML fails on the Effect error channel with a typed ParseError, never throws | implemented |
| `frontmatter-decoded-shape` | `Typechecking` | `decodeSpecFrontmatter` | decoded frontmatter matches the declared SpecFrontmatter type at every branch | implemented |
| `frontmatter-decode-preserves-format-version` | `Inclusion` | `decodeSpecFrontmatter` | every emitted SPEC.md carries \`format-version: &lt;SPEC\_FORMAT\_VERSION&gt;\` in its YAML block and the decode boundary preserves that field on the decoded value (no silent strip during the schema decode) | implemented |
| `link-resolver-intra-file-anchor-pinned` | `Inclusion` | `resolveSymbol` | every intra-file resolution returns an href with the \`#\`-prefixed anchor form; the anchor sha is null at resolve time and the emit step stamps the git short-sha when it renders the anchor | implemented |
| `link-resolver-fails-internal-misses` | `Exception Raising` | `resolveSymbol` | external package references (scoped \`@scope/name\` or bare \`package-name\`) return UnresolvedExternal (no Effect failure); the resolver classifies by shape, leaving fail-closed checking of internal misses to the build-time validate gate | implemented |
| `jsdoc-parser-rejects-unknown-directive` | `Exception Raising` | `parseFileDirectives` | unknown \`@spec.\*\` directive names fail with JsDocUnknownDirectiveError on the Effect error channel | implemented |
| `jsdoc-parser-ast-typechecks` | `Typechecking` | `parseFileDirectives` | every parsed directive matches the closed Directive union shape | implemented |
| `jsdoc-parser-enforces-body-cap` | `Constant Bounds Checking` | `parseFileDirectives`, `enforceLengthCap` | directive bodies longer than DIRECTIVE\_BODY\_MAX\_CHARS fail with JsDocDirectiveOverflowError | implemented |
| `parser-rejects-malformed-dotted-spec-tags` | `Exception Raising` | `parseFileDirectives` | \`@spec.foo\_bar\`, \`@spec.foo.bar\`, \`@spec.Type\` (any dotted form the \`\[a-z\]\[a-z-\]\*\` rewriter doesn't normalize) fail with JsDocUnknownDirectiveError; the closed grammar never silently drops a misspelled directive | implemented |
| `parser-bounds-directive-body-at-any-block-tag` | `Constant Equality` | `parseFileDirectives` | a \`@spec.\*\` directive followed by a standard JSDoc block (\`@param\`, \`@returns\`, \`@throws\`, ...) extracts its body only up to that next block tag — no absorption of unrelated comment content into the directive | implemented |
| `parser-accepts-bare-newline-reason-form` | `Inclusion` | `parseFileDirectives` | the multi-line form \`\* \\@spec.guarantee "x"\\n\* reason: y\` (no horizontal whitespace before \`reason:\`) parses successfully — head and reason split exactly as in the inline / indented forms | implemented |
| `parser-binds-member-directives-to-containing-export` | `Constant Equality` | `parseFileDirectives` | a \`@spec.assume\`/\`@spec.guarantee\` JSDoc on an interface method / property signature / class member binds to the enclosing exportable declaration, not the member itself | implemented |
| `parser-routes-aliased-reexport-directives-to-public-name` | `Constant Equality` | `parseFileDirectives` | JSDoc directives on \`foo\` reach the export entry keyed by the public alias \`bar\` when the barrel re-exports as \`export { foo as bar }\`; \`@spec.ignore-export foo\` also drops the aliased export | implemented |
| `sidecar-writer-roundtrip` | `Roundtrip` | `serializeSidecar`, `decodeSpecArtifact` | decode(parse(serialize(artifact))) returns the original artifact at every well-formed input | implemented |
| `sidecar-writer-atomic-on-failure` | `Exception Raising` | `writeSidecar` | partial sidecars are not left on disk on filesystem failures | implemented |
| `sidecar-writer-maps-root-folder-to-root-slug` | `Constant Equality` | `writeSidecar`, `sidecarSlug` | folder \`"."\` (project root sentinel) writes to \`.safer-spec/root.json\`; the writer's slug helper agrees with \`generate.ts\`/\`validate-pipeline.ts\` so write and validate never disagree on the on-disk path | implemented |
| `sidecar-writer-coalesces-path-separators-into-slug` | `Constant Equality` | `writeSidecar`, `sidecarSlug` | folders containing \`/\` and \`\\\` (Windows-style) produce a single-segment slug (\`src\_spec\`, not a path with separators) so the sidecar file is one filename under \`.safer-spec/\`, never an unintended nested directory | implemented |
| `sidecar-roundtrip` | `Roundtrip` | `decodeSpecArtifact` | encode(decode(json)) is byte-equal to the original well-formed json | implemented |
| `sidecar-rejects-malformed` | `Exception Raising` | `decodeSpecArtifact` | malformed input fails on the Effect error channel with a typed ParseError, never throws | implemented |
| `sidecar-decoded-shape` | `Typechecking` | `decodeSpecArtifact` | decoded artifact matches the declared SpecArtifact type at every branch of the union | implemented |
| `sidecar-preserves-skip-reason-and-residual-contract` | `Inclusion` | `decodeSpecArtifact` | sidecar JSON carries the full \`@spec.skip\` payload (propertyType + reason) and the \`@spec.residual-contract\` payload (tagged "none"/"some" with reason and optional body); JSON-only consumers can distinguish a deliberate opt-out from an incomplete required set | implemented |
| `sidecar-classifies-function-expression-exports` | `Constant Equality` | `decodeSpecArtifact` | \`export const f = function (...) { ... }\` decodes with \`shape: "function"\` and the sidecar's signature is body-stripped, matching the arrow-form (\`export const f = (...) =&gt; {...}\`); the implementation body is never leaked through the sidecar | implemented |
