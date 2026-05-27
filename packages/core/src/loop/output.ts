/** Output metadata written into the artifact meta block for loop-aware evaluation runs. */
export interface LoopOutput {
  iteration: number | null;
  previous_composite: number | null;
  delta: number | null;
  attempted_fixes_count: number;
}

/** Compute the composite delta and assemble the LoopOutput for embedding in artifact meta. */
export function buildLoopOutput(
  compositeScore: number,
  iteration: number | null,
  previousComposite: number | null,
  attemptedFixesCount: number,
): LoopOutput {
  let delta: number | null = null;
  if (previousComposite !== null) {
    delta = compositeScore - previousComposite;
  }

  return {
    iteration,
    previous_composite: previousComposite,
    delta,
    attempted_fixes_count: attemptedFixesCount,
  };
}
