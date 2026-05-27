type ComputedStylesSnapshot = Record<string, Record<string, string>>;

export interface CssCheckResult {
  score: number;
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string[];
  location: null;
}

/** Score the page's color palette size; fewer distinct colors indicates better design consistency. */
export function checkUniqueColorCount(styles: ComputedStylesSnapshot): CssCheckResult {
  const colors = new Set<string>();
  for (const props of Object.values(styles)) {
    if (props['color']) colors.add(props['color']);
    if (props['background-color'] && props['background-color'] !== 'rgba(0, 0, 0, 0)') {
      colors.add(props['background-color']);
    }
    if (props['border-color'] && props['border-color'] !== 'rgb(0, 0, 0)') {
      colors.add(props['border-color']);
    }
  }

  const count = colors.size;
  const score = count <= 5 ? 4 : count <= 10 ? 3 : count <= 20 ? 2 : count <= 30 ? 1 : 0;
  return {
    score,
    evidence: `${count} distinct colors found across page elements`,
    evidence_source: 'css.unique-color-count',
    severity: 4 - score,
    suggested_fix: score < 4 ? [`Reduce color palette to ≤10 distinct colors; ${count} found`] : [],
    location: null,
  };
}

/** Score the number of distinct font families; fewer families indicates better typographic consistency. */
export function checkFontFamilyCount(styles: ComputedStylesSnapshot): CssCheckResult {
  const families = new Set<string>();
  for (const props of Object.values(styles)) {
    if (props['font-family']) {
      // Extract first font-family
      const primary = props['font-family'].split(',')[0].trim().replace(/["']/g, '');
      if (primary) families.add(primary.toLowerCase());
    }
  }

  const count = families.size;
  const score = count <= 2 ? 4 : count <= 3 ? 3 : count <= 4 ? 2 : count <= 6 ? 1 : 0;
  return {
    score,
    evidence: `${count} distinct font families found`,
    evidence_source: 'css.font-family-count',
    severity: 4 - score,
    suggested_fix:
      score < 4
        ? [`Reduce font families for consistency; ${count} distinct families found (target: ≤3)`]
        : [],
    location: null,
  };
}

/** Score spacing consistency by measuring standard deviation of margin/padding values. */
export function checkSpacingConsistency(styles: ComputedStylesSnapshot): CssCheckResult {
  const spacingValues: number[] = [];
  const spacingProps = [
    'margin-top',
    'margin-bottom',
    'padding-top',
    'padding-bottom',
    'margin-left',
    'margin-right',
    'padding-left',
    'padding-right',
  ];

  for (const props of Object.values(styles)) {
    for (const prop of spacingProps) {
      if (props[prop]) {
        const val = parseFloat(props[prop]);
        if (!isNaN(val) && val > 0) spacingValues.push(val);
      }
    }
  }

  if (spacingValues.length < 2) {
    return {
      score: 4,
      evidence: 'Insufficient spacing data',
      evidence_source: 'css.spacing-consistency',
      severity: 0,
      suggested_fix: [],
      location: null,
    };
  }

  const mean = spacingValues.reduce((a, b) => a + b, 0) / spacingValues.length;
  const variance =
    spacingValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / spacingValues.length;
  const stddev = Math.sqrt(variance);

  const score = stddev <= 5 ? 4 : stddev <= 15 ? 3 : stddev <= 30 ? 2 : stddev <= 50 ? 1 : 0;
  return {
    score,
    evidence: `Spacing standard deviation: ${stddev.toFixed(1)}px across ${spacingValues.length} values`,
    evidence_source: 'css.spacing-consistency',
    severity: 4 - score,
    suggested_fix:
      score < 4
        ? [
            `Standardize spacing values; high variance (${stddev.toFixed(1)}) indicates inconsistent spacing system`,
          ]
        : [],
    location: null,
  };
}
