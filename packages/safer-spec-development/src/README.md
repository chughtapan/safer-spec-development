# `@chughtapan/safer-spec-development` — package source

Per-folder SPEC.md TypeScript codemod. Generates structured specs from source
+ JSDoc directives + Effect Schema + fast-check property tests; validates the
resulting artifact against kind-coverage, classifier-coverage, and
precondition-pass-rate gates.

## Folder boundary

The package source is organized into five layered folders plus one root
facade. Layer ordering (top to bottom; higher layers depend only on lower
layers, per `eslint.config.mjs` `layers` declaration):

| Layer        | Folder         | Responsibility                                                              |
|--------------|----------------|-----------------------------------------------------------------------------|
| entrypoint   | `cli/`         | CLI binary (`safer-spec` bin); composes codemod modes and translates exits |
| modes        | `codemod/`     | Six mode entries: `generate`, `validate`, `init`, `doctor`, `migrate`, `explain` |
| pipeline     | `pipeline/`    | Codemod pipeline stages: `applicability`, `link-resolver`, `reporter`, `section-emitter` |
| detection    | `detection/`   | Source-input parsers: `kind-detector`, `jsdoc-parser`                       |
| kernel       | `errors/`, `kernel/` | Tagged-error registry, shared types and schemas, author-facing test helper |

`src/index.ts` is the curated library facade. It is the only public surface
of the package; everything reachable through `import "@chughtapan/safer-spec-development"`
flows through it.

## Why the layers exist

Each layer's reason is recorded in `eslint.config.mjs`. Two key ones:

- **kernel** holds the shared vocabulary (kind taxonomy, sidecar contract,
  frontmatter contract, helper, tagged errors). Every other layer reaches for
  it. The kernel facade `kernel/index.ts` is the single import surface;
  individual files are not consumed directly.
- **detection** stages emit primitive types (`DetectedExport`, `LocatedDirective`)
  that **pipeline** stages consume. The dependency direction is enforced
  structurally by the `layers` config — pipeline files may import detection,
  but never the reverse.

## Where work happens

Stage 1 (this PR set) ships interface stubs with `Effect.die` bodies. The
runtime behavior lands in implement-staff (sub-issue #5) per the parent
epic. The stubs name the public contract every downstream modality consumes;
the bodies are intentionally not implemented.
