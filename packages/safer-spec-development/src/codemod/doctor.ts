/**
 * @spec.purpose
 *   `doctor` mode entrypoint. Health check of configs, deps, sidecar dir,
 *   fast-check version, ts-morph version, format-version compatibility.
 *   Surfaces config drift and version skew before the user hits cryptic gate
 *   failures.
 */

import type { FileSystem, Path } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { DoctorError } from "../errors/index.js";

export interface DoctorCheck {
  readonly name: string;
  readonly status: "pass" | "warn" | "fail";
  readonly message: string;
}

export interface DoctorReport {
  readonly checks: ReadonlyArray<DoctorCheck>;
  readonly overall: "pass" | "warn" | "fail";
}

export const doctor = (): Effect.Effect<
  DoctorReport,
  DoctorError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: doctor not implemented"));
