export function formatSummary(
  compositeScore: number,
  blockingCount: number,
  issueCount: number,
  shipReady: boolean,
): string {
  return `score=${Math.round(compositeScore)} blocking=${blockingCount} issues=${issueCount} ship_ready=${shipReady}`;
}
