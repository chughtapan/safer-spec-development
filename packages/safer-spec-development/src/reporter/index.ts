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

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type {
  SidecarSchemaError,
  SidecarWriteError,
} from "../errors/index.js";
import type { Kind } from "../kinds.js";

export interface ReporterTestRecord {
  readonly propertyId: string;
  readonly kind: Kind;
  readonly classifierShares: ReadonlyArray<{
    readonly partition: string;
    readonly share: number;
  }>;
  readonly preconditionPassRate: number;
  readonly numRuns: number;
}

export interface ReporterRunRecord {
  readonly runId: string;
  readonly gitSha: string;
  readonly moduleHash: string;
  readonly records: ReadonlyArray<ReporterTestRecord>;
}

export const collectTestRecord = (
  _record: ReporterTestRecord,
): Effect.Effect<void, never> =>
  Eff.die(new Error("Stage 1 stub: collectTestRecord not implemented"));

export const finalizeRun = (
  _folder: string,
): Effect.Effect<
  ReporterRunRecord,
  SidecarSchemaError | SidecarWriteError
> => Eff.die(new Error("Stage 1 stub: finalizeRun not implemented"));

export {
  readSidecar,
  serializeSidecar,
  writeSidecar,
} from "./sidecar-writer.js";
export type { SidecarWritePayload } from "./sidecar-writer.js";
