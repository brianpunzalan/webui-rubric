export interface CapCheckResult {
  allowed: boolean;
  message?: string;
}

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
