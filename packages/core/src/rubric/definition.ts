import type {
  RubricDefinition,
  Dimension,
  SubCriterion,
  BoundCheck,
  AnchorTuple,
  ThresholdRange,
  SeverityMapping,
} from '../types/index.js';

/* ------------------------------------------------------------------ */
/*  Threshold helpers                                                  */
/* ------------------------------------------------------------------ */

function lte(v: number): ThresholdRange {
  return { min: null, max: null, operator: 'lte', value: v };
}

function gt(v: number): ThresholdRange {
  return { min: null, max: null, operator: 'gt', value: v };
}

function eq(v: number): ThresholdRange {
  return { min: null, max: null, operator: 'eq', value: v };
}

function range(min: number, max: number): ThresholdRange {
  return { min, max, operator: 'range', value: null };
}

/* ------------------------------------------------------------------ */
/*  Common severity maps                                               */
/* ------------------------------------------------------------------ */

const AXE_SEVERITY: SeverityMapping = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

const INVERSE_SCORE_SEVERITY: SeverityMapping = {
  '0': 4,
  '1': 3,
  '2': 2,
  '3': 1,
  '4': 0,
};

/* ------------------------------------------------------------------ */
/*  Pinned tool versions                                               */
/* ------------------------------------------------------------------ */

const TOOL_VERSIONS: Record<string, string> = {
  'axe-core': '4.10.2',
  lighthouse: '12.2.1',
  pixelmatch: '7.1.0',
  playwright: '1.52.0',
};

function pinnedVersion(family: string): string {
  if (family === 'axe') return TOOL_VERSIONS['axe-core'];
  if (family === 'lighthouse') return TOOL_VERSIONS['lighthouse'];
  if (family === 'pixelmatch') return TOOL_VERSIONS['pixelmatch'];
  if (family === 'playwright') return TOOL_VERSIONS['playwright'];
  // dom, css, console, har are internal
  return '1.0.0';
}

/* ------------------------------------------------------------------ */
/*  Builder helpers                                                    */
/* ------------------------------------------------------------------ */

function buildBoundCheck(
  fullId: string,
  fixTemplate: string,
  severityMap: SeverityMapping,
  thresholdMap: Record<number, ThresholdRange>,
): BoundCheck {
  const [family, ...rest] = fullId.split('.');
  const id = rest.join('.');
  return {
    check_family: family,
    check_id: id,
    full_id: fullId,
    threshold_map: thresholdMap,
    pinned_tool_version: pinnedVersion(family),
    fix_template: fixTemplate,
    severity_map: severityMap,
  };
}

function anchors(tuples: [number, string, string, ThresholdRange][]): AnchorTuple {
  return tuples.map(([score, label, description, threshold]) => ({
    score: score as 0 | 1 | 2 | 3 | 4,
    label,
    description,
    threshold,
  })) as unknown as AnchorTuple;
}

function sub(
  id: string,
  name: string,
  description: string,
  boundCheck: BoundCheck,
  anchorTuple: AnchorTuple,
  opts: {
    blocking_if_zero?: boolean;
    visual_parity?: boolean;
    references?: string[];
  } = {},
): SubCriterion {
  return {
    id,
    name,
    description,
    bound_check: boundCheck,
    anchors: anchorTuple,
    blocking_if_zero: opts.blocking_if_zero ?? false,
    visual_parity: opts.visual_parity ?? false,
    references: opts.references ?? [],
  };
}

function dim(
  id: string,
  name: string,
  weight: number,
  floor: number | null,
  subCriteria: SubCriterion[],
): Dimension {
  return {
    id,
    name,
    default_weight: weight,
    weight_floor: floor,
    sub_criteria: subCriteria,
  };
}

/* ------------------------------------------------------------------ */
/*  Pixel-diff anchors (reused in visual_design, layout, brand,       */
/*  consistency)                                                       */
/* ------------------------------------------------------------------ */

const PIXEL_DIFF_ANCHORS: AnchorTuple = anchors([
  [0, 'Critical', 'Diff ratio > 10%', gt(0.1)],
  [1, 'Poor', 'Diff ratio ≤ 10%', lte(0.1)],
  [2, 'Needs Improvement', 'Diff ratio ≤ 5%', lte(0.05)],
  [3, 'Good', 'Diff ratio ≤ 1%', lte(0.01)],
  [4, 'Excellent', 'No pixel difference', eq(0)],
]);

const PIXEL_DIFF_THRESHOLD_MAP: Record<number, ThresholdRange> = {
  0: gt(0.1),
  1: lte(0.1),
  2: lte(0.05),
  3: lte(0.01),
  4: eq(0),
};

/* ------------------------------------------------------------------ */
/*  Focus-visible anchors (reused in usability, microinteractions)     */
/* ------------------------------------------------------------------ */

const FOCUS_VISIBLE_ANCHORS: AnchorTuple = anchors([
  [0, 'Critical', 'No focus indicators', eq(0)],
  [1, 'Poor', '≤ 25% elements have focus indicators', lte(25)],
  [2, 'Needs Improvement', '≤ 50% elements have focus indicators', lte(50)],
  [3, 'Good', '≤ 90% elements have focus indicators', lte(90)],
  [4, 'Excellent', '> 90% elements have focus indicators', gt(90)],
]);

const FOCUS_VISIBLE_THRESHOLD_MAP: Record<number, ThresholdRange> = {
  0: eq(0),
  1: lte(25),
  2: lte(50),
  3: lte(90),
  4: gt(90),
};

/* ------------------------------------------------------------------ */
/*  Color-count anchors (reused in visual_design, consistency)         */
/* ------------------------------------------------------------------ */

const COLOR_COUNT_ANCHORS: AnchorTuple = anchors([
  [0, 'Critical', '> 30 unique colors', gt(30)],
  [1, 'Poor', '21–30 unique colors', range(21, 30)],
  [2, 'Needs Improvement', '11–20 unique colors', range(11, 20)],
  [3, 'Good', '6–10 unique colors', range(6, 10)],
  [4, 'Excellent', '≤ 5 unique colors', lte(5)],
]);

const COLOR_COUNT_THRESHOLD_MAP: Record<number, ThresholdRange> = {
  0: gt(30),
  1: range(21, 30),
  2: range(11, 20),
  3: range(6, 10),
  4: lte(5),
};

/* ------------------------------------------------------------------ */
/*  Heading-order anchors (reused in accessibility, content_ia)        */
/* ------------------------------------------------------------------ */

const HEADING_ORDER_ANCHORS: AnchorTuple = anchors([
  [0, 'Critical', 'No proper heading hierarchy', eq(0)],
  [1, 'Poor', 'Minimal heading hierarchy', eq(1)],
  [2, 'Needs Improvement', 'Partial heading hierarchy', eq(2)],
  [3, 'Good', 'Mostly correct heading hierarchy', eq(3)],
  [4, 'Excellent', 'Correct heading hierarchy', eq(4)],
]);

const HEADING_ORDER_THRESHOLD_MAP: Record<number, ThresholdRange> = {
  0: eq(0),
  1: eq(1),
  2: eq(2),
  3: eq(3),
  4: eq(4),
};

/* ------------------------------------------------------------------ */
/*  Axe-based anchors (generic: 0 violations = 4, scaling down)        */
/* ------------------------------------------------------------------ */

function axeAnchors(): AnchorTuple {
  return anchors([
    [0, 'Critical', '> 10 violations', gt(10)],
    [1, 'Poor', '≤ 10 violations', lte(10)],
    [2, 'Needs Improvement', '≤ 5 violations', lte(5)],
    [3, 'Good', '≤ 2 violations', lte(2)],
    [4, 'Excellent', 'No violations', eq(0)],
  ]);
}

function axeThresholdMap(): Record<number, ThresholdRange> {
  return {
    0: gt(10),
    1: lte(10),
    2: lte(5),
    3: lte(2),
    4: eq(0),
  };
}

/* ------------------------------------------------------------------ */
/*  DOM boolean-style anchors (image-alt, form-labels)                 */
/* ------------------------------------------------------------------ */

function domBoolAnchors(): AnchorTuple {
  return anchors([
    [0, 'Critical', 'No compliance', eq(0)],
    [1, 'Poor', 'Minimal compliance', eq(1)],
    [2, 'Needs Improvement', 'Partial compliance', eq(2)],
    [3, 'Good', 'Mostly compliant', eq(3)],
    [4, 'Excellent', 'Fully compliant', eq(4)],
  ]);
}

function domBoolThresholdMap(): Record<number, ThresholdRange> {
  return {
    0: eq(0),
    1: eq(1),
    2: eq(2),
    3: eq(3),
    4: eq(4),
  };
}

/* ------------------------------------------------------------------ */
/*  Dimension definitions                                              */
/* ------------------------------------------------------------------ */

const dimensions: Dimension[] = [
  /* 1. visual_design — weight 10 */
  dim('visual_design', 'Visual Design & Aesthetics', 10, null, [
    sub(
      'visual_design.color-harmony',
      'Color Harmony',
      'Number of unique colors used across the page',
      buildBoundCheck(
        'css.unique-color-count',
        'Reduce color palette to ≤10 distinct colors',
        INVERSE_SCORE_SEVERITY,
        COLOR_COUNT_THRESHOLD_MAP,
      ),
      COLOR_COUNT_ANCHORS,
    ),
    sub(
      'visual_design.visual-parity-desktop',
      'Visual Parity — Desktop',
      'Pixel-level comparison against reference design at desktop viewport',
      buildBoundCheck(
        'pixelmatch.viewport=desktop',
        'Align desktop layout with reference design',
        INVERSE_SCORE_SEVERITY,
        PIXEL_DIFF_THRESHOLD_MAP,
      ),
      PIXEL_DIFF_ANCHORS,
      { visual_parity: true },
    ),
  ]),

  /* 2. layout — weight 10 */
  dim('layout', 'Layout & Responsiveness', 10, null, [
    sub(
      'layout.viewport-meta',
      'Viewport Meta Tag',
      'Presence and correctness of viewport meta tag',
      buildBoundCheck('dom.meta-viewport', 'Add proper viewport meta tag', INVERSE_SCORE_SEVERITY, {
        0: eq(0),
        1: eq(1),
        2: eq(2),
        3: eq(3),
        4: eq(4),
      }),
      anchors([
        [0, 'Critical', 'No viewport meta tag', eq(0)],
        [1, 'Poor', 'Incomplete viewport meta tag', eq(1)],
        [2, 'Needs Improvement', 'Partial viewport meta tag', eq(2)],
        [3, 'Good', 'Mostly correct viewport meta tag', eq(3)],
        [4, 'Excellent', 'Correct viewport meta tag', eq(4)],
      ]),
    ),
    sub(
      'layout.spacing-consistency',
      'Spacing Consistency',
      'Variance in spacing values across elements',
      buildBoundCheck(
        'css.spacing-consistency',
        'Standardize spacing values',
        INVERSE_SCORE_SEVERITY,
        {
          0: gt(50),
          1: lte(50),
          2: lte(30),
          3: lte(15),
          4: lte(5),
        },
      ),
      anchors([
        [0, 'Critical', '> 50 spacing variants', gt(50)],
        [1, 'Poor', '≤ 50 spacing variants', lte(50)],
        [2, 'Needs Improvement', '≤ 30 spacing variants', lte(30)],
        [3, 'Good', '≤ 15 spacing variants', lte(15)],
        [4, 'Excellent', '≤ 5 spacing variants', lte(5)],
      ]),
    ),
    sub(
      'layout.visual-parity-mobile',
      'Visual Parity — Mobile',
      'Pixel-level comparison against reference design at mobile viewport',
      buildBoundCheck(
        'pixelmatch.viewport=mobile',
        'Align mobile layout with reference design',
        INVERSE_SCORE_SEVERITY,
        PIXEL_DIFF_THRESHOLD_MAP,
      ),
      PIXEL_DIFF_ANCHORS,
      { visual_parity: true },
    ),
  ]),

  /* 3. usability — weight 12 */
  dim('usability', 'Usability & Interaction Design', 12, null, [
    sub(
      'usability.focus-visible',
      'Focus Visible Indicators',
      'Percentage of interactive elements with :focus-visible styles',
      buildBoundCheck(
        'playwright.focus-visible',
        'Add :focus-visible indicator to interactive elements',
        INVERSE_SCORE_SEVERITY,
        FOCUS_VISIBLE_THRESHOLD_MAP,
      ),
      FOCUS_VISIBLE_ANCHORS,
    ),
    sub(
      'usability.link-descriptiveness',
      'Link Descriptiveness',
      'Percentage of links with generic text (e.g. "click here")',
      buildBoundCheck(
        'dom.link-descriptiveness',
        'Replace generic link text with descriptive text',
        INVERSE_SCORE_SEVERITY,
        {
          0: gt(50),
          1: lte(50),
          2: lte(15),
          3: lte(5),
          4: lte(1),
        },
      ),
      anchors([
        [0, 'Critical', '> 50% generic links', gt(50)],
        [1, 'Poor', '≤ 50% generic links', lte(50)],
        [2, 'Needs Improvement', '≤ 15% generic links', lte(15)],
        [3, 'Good', '≤ 5% generic links', lte(5)],
        [4, 'Excellent', '≤ 1% generic links', lte(1)],
      ]),
    ),
  ]),

  /* 4. accessibility — weight 15, floor 10 */
  dim('accessibility', 'Accessibility — WCAG 2.2', 15, 10, [
    sub(
      'accessibility.color-contrast',
      'Color Contrast',
      'WCAG 2.2 color contrast compliance via axe-core',
      buildBoundCheck(
        'axe.color-contrast',
        'Fix color contrast to meet WCAG 2.2 AA ratio (4.5:1)',
        AXE_SEVERITY,
        axeThresholdMap(),
      ),
      axeAnchors(),
      { blocking_if_zero: true, references: ['WCAG 2.2 §1.4.3'] },
    ),
    sub(
      'accessibility.image-alt',
      'Image Alt Text',
      'All images must have descriptive alt attributes',
      buildBoundCheck(
        'dom.image-alt',
        'Add descriptive alt text to all images',
        INVERSE_SCORE_SEVERITY,
        domBoolThresholdMap(),
      ),
      domBoolAnchors(),
      { blocking_if_zero: true, references: ['WCAG 2.2 §1.1.1'] },
    ),
    sub(
      'accessibility.form-labels',
      'Form Labels',
      'All form controls must have associated labels',
      buildBoundCheck(
        'dom.form-labels',
        'Associate a label with every form control',
        INVERSE_SCORE_SEVERITY,
        domBoolThresholdMap(),
      ),
      domBoolAnchors(),
      { blocking_if_zero: true, references: ['WCAG 2.2 §1.3.1'] },
    ),
    sub(
      'accessibility.aria-valid',
      'ARIA Validity',
      'All ARIA attributes must be valid per WAI-ARIA spec',
      buildBoundCheck(
        'axe.aria-valid-attr',
        'Fix invalid ARIA attributes',
        AXE_SEVERITY,
        axeThresholdMap(),
      ),
      axeAnchors(),
    ),
    sub(
      'accessibility.heading-order',
      'Heading Order',
      'Heading levels must follow a logical hierarchy',
      buildBoundCheck(
        'dom.heading-order',
        'Fix heading hierarchy to follow sequential order',
        INVERSE_SCORE_SEVERITY,
        HEADING_ORDER_THRESHOLD_MAP,
      ),
      HEADING_ORDER_ANCHORS,
      { references: ['WCAG 2.2 §1.3.1'] },
    ),
  ]),

  /* 5. content_ia — weight 8 */
  dim('content_ia', 'Content & Information Architecture', 8, null, [
    sub(
      'content_ia.heading-structure',
      'Heading Structure',
      'Logical heading hierarchy throughout the page',
      buildBoundCheck(
        'dom.heading-order',
        'Establish a clear heading hierarchy',
        INVERSE_SCORE_SEVERITY,
        HEADING_ORDER_THRESHOLD_MAP,
      ),
      HEADING_ORDER_ANCHORS,
    ),
    sub(
      'content_ia.landmark-usage',
      'Landmark Usage',
      'Appropriate use of HTML5 landmark elements',
      buildBoundCheck(
        'dom.landmark-usage',
        'Add semantic landmark elements (header, nav, main, footer)',
        INVERSE_SCORE_SEVERITY,
        {
          0: eq(0),
          1: eq(1),
          2: eq(2),
          3: eq(3),
          4: lte(4),
        },
      ),
      anchors([
        [0, 'Critical', 'No landmark elements', eq(0)],
        [1, 'Poor', '1 landmark element', eq(1)],
        [2, 'Needs Improvement', '2 landmark elements', eq(2)],
        [3, 'Good', '3 landmark elements', eq(3)],
        [4, 'Excellent', '≥ 4 landmark elements', lte(4)],
      ]),
    ),
  ]),

  /* 6. performance — weight 12 */
  dim('performance', 'Performance & Technical Quality', 12, null, [
    sub(
      'performance.lcp',
      'Largest Contentful Paint',
      'Time until the largest content element is rendered',
      buildBoundCheck('lighthouse.lcp', 'Reduce LCP (target: ≤2500ms)', INVERSE_SCORE_SEVERITY, {
        0: gt(6000),
        1: lte(6000),
        2: lte(4000),
        3: lte(2500),
        4: lte(1200),
      }),
      anchors([
        [0, 'Critical', 'LCP > 6000ms', gt(6000)],
        [1, 'Poor', 'LCP ≤ 6000ms', lte(6000)],
        [2, 'Needs Improvement', 'LCP ≤ 4000ms', lte(4000)],
        [3, 'Good', 'LCP ≤ 2500ms', lte(2500)],
        [4, 'Excellent', 'LCP ≤ 1200ms', lte(1200)],
      ]),
    ),
    sub(
      'performance.fcp',
      'First Contentful Paint',
      'Time until the first content element is rendered',
      buildBoundCheck('lighthouse.fcp', 'Reduce FCP (target: ≤1800ms)', INVERSE_SCORE_SEVERITY, {
        0: gt(6000),
        1: lte(6000),
        2: lte(4000),
        3: lte(1800),
        4: lte(1000),
      }),
      anchors([
        [0, 'Critical', 'FCP > 6000ms', gt(6000)],
        [1, 'Poor', 'FCP ≤ 6000ms', lte(6000)],
        [2, 'Needs Improvement', 'FCP ≤ 4000ms', lte(4000)],
        [3, 'Good', 'FCP ≤ 1800ms', lte(1800)],
        [4, 'Excellent', 'FCP ≤ 1000ms', lte(1000)],
      ]),
    ),
    sub(
      'performance.cls',
      'Cumulative Layout Shift',
      'Visual stability of the page during loading',
      buildBoundCheck('lighthouse.cls', 'Reduce CLS (target: ≤0.1)', INVERSE_SCORE_SEVERITY, {
        0: gt(0.5),
        1: lte(0.5),
        2: lte(0.25),
        3: lte(0.1),
        4: lte(0.05),
      }),
      anchors([
        [0, 'Critical', 'CLS > 0.5', gt(0.5)],
        [1, 'Poor', 'CLS ≤ 0.5', lte(0.5)],
        [2, 'Needs Improvement', 'CLS ≤ 0.25', lte(0.25)],
        [3, 'Good', 'CLS ≤ 0.1', lte(0.1)],
        [4, 'Excellent', 'CLS ≤ 0.05', lte(0.05)],
      ]),
    ),
    sub(
      'performance.tbt',
      'Total Blocking Time',
      'Total time the main thread was blocked during load',
      buildBoundCheck('lighthouse.tbt', 'Reduce TBT (target: ≤300ms)', INVERSE_SCORE_SEVERITY, {
        0: gt(2000),
        1: lte(2000),
        2: lte(600),
        3: lte(300),
        4: lte(150),
      }),
      anchors([
        [0, 'Critical', 'TBT > 2000ms', gt(2000)],
        [1, 'Poor', 'TBT ≤ 2000ms', lte(2000)],
        [2, 'Needs Improvement', 'TBT ≤ 600ms', lte(600)],
        [3, 'Good', 'TBT ≤ 300ms', lte(300)],
        [4, 'Excellent', 'TBT ≤ 150ms', lte(150)],
      ]),
    ),
    sub(
      'performance.resource-efficiency',
      'Resource Efficiency',
      'Total number of network resources loaded',
      buildBoundCheck(
        'har.resource-count',
        'Reduce resource count (target: ≤40 requests)',
        INVERSE_SCORE_SEVERITY,
        {
          0: gt(100),
          1: lte(100),
          2: lte(60),
          3: lte(40),
          4: lte(25),
        },
      ),
      anchors([
        [0, 'Critical', '> 100 resources', gt(100)],
        [1, 'Poor', '≤ 100 resources', lte(100)],
        [2, 'Needs Improvement', '≤ 60 resources', lte(60)],
        [3, 'Good', '≤ 40 resources', lte(40)],
        [4, 'Excellent', '≤ 25 resources', lte(25)],
      ]),
    ),
  ]),

  /* 7. code_quality — weight 8 */
  dim('code_quality', 'Code Quality — UI relevant', 8, null, [
    sub(
      'code_quality.console-errors',
      'Console Errors',
      'Number of JavaScript console errors during page load',
      buildBoundCheck(
        'console.error-count',
        'Fix JavaScript console errors',
        INVERSE_SCORE_SEVERITY,
        {
          0: gt(10),
          1: lte(10),
          2: lte(5),
          3: lte(2),
          4: eq(0),
        },
      ),
      anchors([
        [0, 'Critical', '> 10 console errors', gt(10)],
        [1, 'Poor', '≤ 10 console errors', lte(10)],
        [2, 'Needs Improvement', '≤ 5 console errors', lte(5)],
        [3, 'Good', '≤ 2 console errors', lte(2)],
        [4, 'Excellent', 'No console errors', eq(0)],
      ]),
    ),
  ]),

  /* 8. brand — weight 5 */
  dim('brand', 'Brand & Emotional Design', 5, null, [
    sub(
      'brand.visual-parity-brand',
      'Visual Parity — Brand',
      'Pixel-level comparison for brand consistency against reference',
      buildBoundCheck(
        'pixelmatch.viewport=desktop',
        'Align visual output with brand reference design',
        INVERSE_SCORE_SEVERITY,
        PIXEL_DIFF_THRESHOLD_MAP,
      ),
      PIXEL_DIFF_ANCHORS,
      { visual_parity: true },
    ),
  ]),

  /* 9. consistency — weight 10 */
  dim('consistency', 'Consistency & Design System Adherence', 10, null, [
    sub(
      'consistency.color-count',
      'Color Count',
      'Number of unique colors indicating design system adherence',
      buildBoundCheck(
        'css.unique-color-count',
        'Reduce color palette to use design system tokens',
        INVERSE_SCORE_SEVERITY,
        COLOR_COUNT_THRESHOLD_MAP,
      ),
      COLOR_COUNT_ANCHORS,
    ),
    sub(
      'consistency.font-family-count',
      'Font Family Count',
      'Number of distinct font families used',
      buildBoundCheck(
        'css.font-family-count',
        'Limit font families to design system typefaces',
        INVERSE_SCORE_SEVERITY,
        {
          0: gt(6),
          1: lte(6),
          2: lte(4),
          3: lte(3),
          4: lte(2),
        },
      ),
      anchors([
        [0, 'Critical', '> 6 font families', gt(6)],
        [1, 'Poor', '≤ 6 font families', lte(6)],
        [2, 'Needs Improvement', '≤ 4 font families', lte(4)],
        [3, 'Good', '≤ 3 font families', lte(3)],
        [4, 'Excellent', '≤ 2 font families', lte(2)],
      ]),
    ),
    sub(
      'consistency.visual-parity-consistency',
      'Visual Parity — Consistency',
      'Pixel-level comparison for design system consistency',
      buildBoundCheck(
        'pixelmatch.viewport=desktop',
        'Align visual output with design system reference',
        INVERSE_SCORE_SEVERITY,
        PIXEL_DIFF_THRESHOLD_MAP,
      ),
      PIXEL_DIFF_ANCHORS,
      { visual_parity: true },
    ),
  ]),

  /* 10. microinteractions — weight 10 */
  dim('microinteractions', 'Microinteractions, Motion & States', 10, null, [
    sub(
      'microinteractions.focus-states',
      'Focus States',
      'Percentage of interactive elements with visible focus states',
      buildBoundCheck(
        'playwright.focus-visible',
        'Add visible focus states to all interactive elements',
        INVERSE_SCORE_SEVERITY,
        FOCUS_VISIBLE_THRESHOLD_MAP,
      ),
      FOCUS_VISIBLE_ANCHORS,
    ),
  ]),
];

/* ------------------------------------------------------------------ */
/*  Exported rubric definition                                         */
/* ------------------------------------------------------------------ */

export const V1_RUBRIC: RubricDefinition = {
  rubric_version: '1.0.0',
  tool_versions: TOOL_VERSIONS,
  dimensions,
};
