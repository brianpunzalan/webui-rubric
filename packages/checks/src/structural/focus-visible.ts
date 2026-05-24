export interface FocusVisibleResult {
  score: number | null;
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string;
  location: null;
}

export async function checkFocusVisible(page: unknown): Promise<FocusVisibleResult> {
  try {
    const p = page as import('playwright').Page;

    const result = await p.evaluate(() => {
      const interactive = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
      let total = 0;
      let withFocus = 0;

      interactive.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        total++;

        // Check if element has focus-visible styles defined
        // We check for outline, box-shadow, or border changes
        const outline = style.outlineStyle;
        if (outline && outline !== 'none') withFocus++;
      });

      return { total, withFocus };
    });

    if (result.total === 0) {
      return { score: 4, evidence: 'No interactive elements found', evidence_source: 'playwright.focus-visible', severity: 0, suggested_fix: '', location: null };
    }

    const pct = (result.withFocus / result.total) * 100;
    const score = pct > 90 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : pct > 0 ? 1 : 0;

    return {
      score,
      evidence: `${result.withFocus}/${result.total} interactive elements (${pct.toFixed(0)}%) have focus indicators`,
      evidence_source: 'playwright.focus-visible',
      severity: 4 - score,
      suggested_fix: score < 4 ? 'Add visible focus indicator to interactive elements missing :focus-visible' : '',
      location: null,
    };
  } catch {
    return {
      score: null,
      evidence: 'Focus-visible check could not be executed',
      evidence_source: 'playwright.focus-visible',
      severity: 0,
      suggested_fix: '',
      location: null,
    };
  }
}
