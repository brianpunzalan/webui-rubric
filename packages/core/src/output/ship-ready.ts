import type { BlockingEntry } from '../types/index.js';

/** Determine if the UI is ship-ready: no blocking issues and composite score meets threshold. */
export function isShipReady(
  blocking: BlockingEntry[],
  compositeScore: number,
  threshold: number = 75,
): boolean {
  return blocking.length === 0 && compositeScore >= threshold;
}
