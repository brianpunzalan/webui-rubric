import type { MappedDiffRegion } from './element-mapper.js';

export function buildVisualParitySuggestedFix(input: {
  mappedRegions: MappedDiffRegion[];
  diffRatio: number;
}): string[] {
  const { mappedRegions, diffRatio } = input;

  if (mappedRegions.length === 0) {
    return [
      `${(diffRatio * 100).toFixed(1)}% pixel diff detected. Review the diff image for details.`,
    ];
  }

  const suggestions: string[] = [];
  for (const region of mappedRegions) {
    for (const el of region.elements) {
      const bgDiff = el.styleDiffs.find(
        (d) => d.property === 'background-color' && d.expected !== 'see reference',
      );
      const otherDiffs = el.styleDiffs.filter((d) => d.expected === 'see reference').slice(0, 2);

      const parts: string[] = [];
      if (bgDiff) {
        parts.push(`background-color ${bgDiff.actual}→${bgDiff.expected}`);
      }
      for (const d of otherDiffs) {
        parts.push(`${d.property}: ${d.actual} (check reference)`);
      }

      if (parts.length > 0) {
        suggestions.push(`${el.selector}: ${parts.join(', ')}`);
      } else {
        suggestions.push(
          `${el.selector}: visual diff detected (y:${region.y_start}-${region.y_end})`,
        );
      }
    }
  }

  return suggestions.length > 0
    ? suggestions
    : [`${(diffRatio * 100).toFixed(1)}% pixel diff detected. Review the diff image for details.`];
}
