/** Result of an iteration cap check, indicating whether the run is allowed to proceed. */
export interface CapCheckResult {
  allowed: boolean;
  message?: string;
}

/** Check whether the current iteration exceeds the configured cap, unless overrun is allowed. */
export function checkIterationCap(
  iteration: number | null,
  cap: number = 5,
  allowOverrun: boolean = false,
): CapCheckResult {
  if (iteration === null) return { allowed: true };

  if (iteration > cap && !allowOverrun) {
    return {
      allowed: false,
      message: `Iteration ${iteration} exceeds the configured cap of ${cap}. Use --allow-overrun to proceed.`,
    };
  }

  return { allowed: true };
}
