/**
 * @specPurpose
 *   `doctor` command entrypoint. Health check of configs, deps, sidecar dir,
 *   format-version compatibility. Surfaces config drift and version skew
 *   before the user hits cryptic gate failures.
 *
 *   Tagged error `DoctorError` is co-located here.
 */

import type { FileSystem, Path } from "@effect/platform";
import { Data, Effect } from "effect";

export class DoctorError extends Data.TaggedError("DoctorError")<{
  readonly check: string;
  readonly reason: string;
}> {}

interface DoctorCheck {
  readonly name: string;
  readonly status: "pass" | "warn" | "fail";
  readonly message: string;
}

interface DoctorReport {
  readonly checks: ReadonlyArray<DoctorCheck>;
  readonly overall: "pass" | "warn" | "fail";
}

/**
 * @specGuarantee "no check mutates the workspace; doctor is read-only"
 *   reason: side-effect contract; users invoke doctor on production
 *           checkouts.
 * @specResidualContract "individual check failure does not short-circuit; the report aggregates all check results, with `overall` derived from the worst status"
 *   reason: behavioral contract beyond the Effect signature.
 */
export const doctor = (): Effect.Effect<
  DoctorReport,
  DoctorError,
  FileSystem.FileSystem | Path.Path
> => Effect.die(new Error("Not implemented: doctor"));
