# `pipeline/` — codemod pipeline stages

The four pipeline stages the codemod mode entries compose. Stage ordering
is data flow, not import direction (the `codemod/` modes orchestrate the
ordering):

```
detection/kind-detector ─┐
                         ├─► applicability ─► section-emitter ─► reporter
detection/jsdoc-parser ──┘                  │
                                            └─► link-resolver
```

| Folder              | Stage                                                                                                    |
|---------------------|----------------------------------------------------------------------------------------------------------|
| `applicability/`    | Resolves the required-kind set for each detected export from the applicability matrix + escape hatches.  |
| `link-resolver/`    | Resolves backticked symbol references in SPEC.md body prose to anchored hrefs (intra-file + cross-spec). |
| `reporter/`         | Vitest reporter for `safer-spec-prop` property tests + sidecar JSON writer.                              |
| `section-emitter/`  | Emits canonical SPEC.md from the resolved export set; bytes are stable at a given tree SHA.              |

## Dependency direction

Pipeline stages depend on `detection/` (downward, per layers config) and on
the kernel (`kernel/index.js` facade). Pipeline stages do not depend on each
other through the filesystem — the codemod mode entries are the
composition root that orders them.
