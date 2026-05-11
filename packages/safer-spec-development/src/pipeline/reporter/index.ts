/**
 * @spec.purpose
 *   Vitest reporter for `safer-spec-prop` property tests. Captures per-test
 *   `fc.statistics` partition shares and precondition rejection counts via the
 *   per-test logger wrapper (not `fc.configureGlobal` — process-global state
 *   races under Vitest worker pools). Emits the sidecar JSON the validate
 *   gate consumes.
 *
 * @spec.guarantee Reporter never trusts a stale sidecar: every write carries
 *   the run-id, the git short-sha, and the module hash of the
 *   `*.spec.test.ts` file that produced it.
 *   reason: the validate gate must be able to detect stale CI artifacts.
 */

export { serializeSidecar, writeSidecar } from "./sidecar-writer.js";
