# `codemod/` — mode entry points

The codemod's six mode entries. Each file declares one mode's input/output
contract and an `Effect`-typed stub body. The mode entries compose pipeline
stages (`pipeline/applicability`, `pipeline/section-emitter`, etc.) to
produce SPEC.md + `.safer-spec/<folder>.json` sidecars.

| File           | Mode entry              | Purpose                                                            |
|----------------|-------------------------|--------------------------------------------------------------------|
| `generate.ts`  | `generate`              | Scrape source + JSDoc + properties; emit SPEC.md + sidecar JSON   |
| `validate.ts`  | `validate`              | Re-generate to memory; diff against on-disk; assert the 3 gates    |
| `init.ts`      | `init`                  | Scaffold first SPEC.md + stub `*.spec.test.ts` + config            |
| `doctor.ts`    | `doctor`                | Health check of configs, deps, sidecar dir, version compatibility |
| `migrate.ts`   | `migrate`               | Walk SPEC.md + config for format-version transitions              |
| `explain.ts`   | `explain`               | Look up an error code in `docs/errors.md` and emit the entry      |
| `index.ts`     | facade                  | Re-exports the six modes for the CLI + library facade             |

External callers (cli/, library facade) reach the modes through
`codemod/index.ts`. The per-mode files are internal compartments of the
codemod surface; consumers do not import them directly.

The `validate` exit-code contract (per the Stage 5 spec's Amendment 5
mapping): `0` for pass, `11` for MISSING_SPEC_PROPERTY, `12` for MISSING_STUB,
`13` for MISSING_IMPL. The CLI binary translates the `ValidateError.gapClass`
into `process.exit(N)`.
