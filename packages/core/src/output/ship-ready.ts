import type { BlockingEntry } from '../types/index.js';

export function isShipReady(
  blocking: BlockingEntry[],
  compositeScore: number,
  threshold: number = 75,
): boolean {
  return blocking.length === 0 && compositeScore >= threshold;
}
