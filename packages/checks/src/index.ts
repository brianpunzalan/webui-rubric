export { runAxeChecks, accessibilityAdapter } from './accessibility/index.js';
export { runLighthouseChecks } from './performance/index.js';
export { PERFORMANCE_METRICS, scoreFromMetric } from './performance/metric-map.js';
export {
  checkHeadingOrder,
  checkLandmarkUsage,
  checkLinkDescriptiveness,
  checkImageAlt,
  checkFormLabels,
  checkMetaViewport,
} from './structural/dom-checks.js';
export {
  checkUniqueColorCount,
  checkFontFamilyCount,
  checkSpacingConsistency,
} from './structural/css-checks.js';
export { checkConsoleErrors, checkResourceCount } from './structural/runtime-checks.js';
export { checkFocusVisible } from './structural/focus-visible.js';
export { axeSeverity, AXE_IMPACT_TO_SEVERITY } from './accessibility/severity-map.js';
export {
  runPixelmatch,
  type PixelComparisonInput,
  type PixelComparisonOutput,
} from './pixelmatch/index.js';
export { scoreFromDiffRatio } from './pixelmatch/scoring.js';
export { buildVisualParitySuggestedFix } from './pixelmatch/suggested-fix.js';
export { analyzeDiffRegions, type DiffRegion } from './pixelmatch/diff-regions.js';
export {
  mapDiffRegionsToElements,
  type MappedDiffRegion,
  type MappedDiffElement,
  type StyleDiff,
} from './pixelmatch/element-mapper.js';
export {
  runMultiViewportComparison,
  type ViewportComparisonInput,
} from './pixelmatch/multi-viewport.js';
