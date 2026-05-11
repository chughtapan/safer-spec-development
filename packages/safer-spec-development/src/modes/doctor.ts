/**
 * @spec.purpose
 *   `doctor` mode entrypoint. Health check of configs, deps, sidecar dir,
 *   format-version compatibility. Surfaces config drift and version skew
 *   before the user hits cryptic gate failures.
 */

import type { FileSystem, Path } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { DoctorError } from "../errors/index.js";

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
 * @spec.guarantee "no check mutates the workspace; doctor is read-only"
 *   reason: side-effect contract; users invoke doctor on production
 *           checkouts.
 * @spec.residual-contract "individual check failure does not short-circuit; the report aggregates all check results, with `overall` derived from the worst status"
 *   reason: behavioral contract beyond the Effect signature.
 */
export const doctor = (): Effect.Effect<
  DoctorReport,
  DoctorError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: doctor not implemented"));
