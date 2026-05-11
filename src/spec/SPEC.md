---
folder: src/spec
format-version: 0.1.0
---

# SPEC

## Purpose

Spec domain barrel. Anchors `src/spec/SPEC.md` (codemod requires every folder with a SPEC to expose an `index.ts` barrel) and re-exports the test-author surface (`itSpec`, `ItSpec`) consumed by the package facade. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by `commands/` via path aliases; routing it through this barrel would be ceremony without a caller.

## Public surface

_No exports._
## Files

- `src/spec/__tests__/emit.spec.test.ts`
- `src/spec/__tests__/frontmatter.spec.test.ts`
- `src/spec/__tests__/link-resolver.spec.test.ts`
- `src/spec/__tests__/parser.spec.test.ts`
- `src/spec/__tests__/sidecar-writer.spec.test.ts`
- `src/spec/__tests__/sidecar.spec.test.ts`
- `src/spec/emit.ts`
- `src/spec/escape.ts`
- `src/spec/frontmatter.ts`
- `src/spec/index.ts`
- `src/spec/it-spec.ts`
- `src/spec/link-resolver.ts`
- `src/spec/sidecar-writer.ts`
- `src/spec/sidecar.ts`
- `src/spec/source-exports.ts`
- `src/spec/todos.ts`

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
| `jsdoc-parser-rejects-unknown-directive` | `Exception Raising` | `parseFileDirectives` | unknown @spec.* directive names fail with JsDocUnknownDirectiveError on the Effect error channel | todo |
| `jsdoc-parser-ast-typechecks` | `Typechecking` | `parseFileDirectives` | every parsed directive matches the closed Directive union shape | todo |
| `jsdoc-parser-enforces-body-cap` | `Constant Bounds Checking` | `parseFileDirectives`, `enforceLengthCap` | directive bodies longer than DIRECTIVE_BODY_MAX_CHARS fail with JsDocDirectiveOverflowError | todo |
| `jsdoc-escape-markdown-safe` | `Constant Bounds Checking` | `escapeForMarkdown` | escaped output never introduces new markdown syntactic structure (backticks, code-fences, link syntax) | todo |
| `jsdoc-escape-yaml-safe` | `Constant Bounds Checking` | `escapeForYaml` | escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes) | todo |
| `jsdoc-escape-json-safe` | `Constant Bounds Checking` | `escapeForJson` | escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars) | todo |
| `sidecar-writer-roundtrip` | `Roundtrip` | `serializeSidecar`, `decodeSpecArtifact` | decode(parse(serialize(artifact))) returns the original artifact at every well-formed input | todo |
| `sidecar-writer-atomic-on-failure` | `Exception Raising` | `writeSidecar` | partial sidecars are not left on disk on filesystem failures | todo |
| `sidecar-roundtrip` | `Roundtrip` | `decodeSpecArtifact` | encode(decode(json)) is byte-equal to the original well-formed json | todo |
| `sidecar-rejects-malformed` | `Exception Raising` | `decodeSpecArtifact` | malformed input fails on the Effect error channel with a typed ParseError, never throws | todo |
| `sidecar-decoded-shape` | `Typechecking` | `decodeSpecArtifact` | decoded artifact matches the declared SpecArtifact type at every branch of the union | todo |
