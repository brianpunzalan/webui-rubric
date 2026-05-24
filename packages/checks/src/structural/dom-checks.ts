export interface StructuralCheckResult {
  score: number;
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string;
  location: { type: 'selector'; selector: string | null; bounding_box: null; viewport: null } | null;
}

// dom.heading-order: Check heading hierarchy for skipped levels
export function checkHeadingOrder(html: string): StructuralCheckResult {
  const headingRegex = /<h([1-6])[^>]*>/gi;
  const levels: number[] = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    levels.push(parseInt(match[1], 10));
  }

  let skips = 0;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) skips++;
  }

  const score = skips === 0 ? 4 : skips === 1 ? 3 : skips === 2 ? 2 : skips <= 5 ? 1 : 0;
  return {
    score,
    evidence: `Heading hierarchy: ${skips} level skips detected in ${levels.length} headings`.slice(0, 300),
    evidence_source: 'dom.heading-order',
    severity: 4 - score,
    suggested_fix: score < 4 ? `Fix heading hierarchy; headings skip levels (${skips} violations)`.slice(0, 280) : '',
    location: null,
  };
}

// dom.landmark-usage: Check for semantic landmarks (main, nav, header, footer)
export function checkLandmarkUsage(html: string): StructuralCheckResult {
  const landmarks = ['main', 'nav', 'header', 'footer'];
  let count = 0;
  for (const lm of landmarks) {
    if (new RegExp(`<${lm}[\\s>]`, 'i').test(html)) count++;
  }

  const score = count >= 4 ? 4 : count === 3 ? 3 : count === 2 ? 2 : count === 1 ? 1 : 0;
  return {
    score,
    evidence: `Semantic landmarks found: ${count}/4 (main, nav, header, footer)`.slice(0, 300),
    evidence_source: 'dom.landmark-usage',
    severity: 4 - score,
    suggested_fix: score < 4 ? 'Add semantic landmarks: <main>, <nav>, <header>, <footer>'.slice(0, 280) : '',
    location: null,
  };
}

// dom.link-descriptiveness: Detect generic link text
export function checkLinkDescriptiveness(html: string): StructuralCheckResult {
  const linkRegex = /<a[^>]*>(.*?)<\/a>/gi;
  const genericPatterns = /^(click here|here|read more|learn more|more|link|this)$/i;

  let totalLinks = 0;
  let genericLinks = 0;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text.length === 0) continue;
    totalLinks++;
    if (genericPatterns.test(text)) genericLinks++;
  }

  if (totalLinks === 0) {
    return { score: 4, evidence: 'No links found on page', evidence_source: 'dom.link-descriptiveness', severity: 0, suggested_fix: '', location: null };
  }

  const pct = (genericLinks / totalLinks) * 100;
  const score = pct <= 1 ? 4 : pct <= 5 ? 3 : pct <= 15 ? 2 : pct <= 50 ? 1 : 0;
  return {
    score,
    evidence: `${genericLinks}/${totalLinks} links (${pct.toFixed(1)}%) use generic text`.slice(0, 300),
    evidence_source: 'dom.link-descriptiveness',
    severity: 4 - score,
    suggested_fix: score < 4 ? "Replace generic link text ('click here', 'read more') with descriptive text".slice(0, 280) : '',
    location: null,
  };
}

// dom.image-alt: Check for missing alt attributes on images
export function checkImageAlt(html: string): StructuralCheckResult {
  const imgRegex = /<img[^>]*>/gi;
  const images: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) images.push(match[0]);

  if (images.length === 0) {
    return { score: 4, evidence: 'No images found on page', evidence_source: 'dom.image-alt', severity: 0, suggested_fix: '', location: null };
  }

  let missingAlt = 0;
  for (const img of images) {
    if (!/\salt\s*=/i.test(img)) missingAlt++;
  }

  const pct = (missingAlt / images.length) * 100;
  const score = pct === 0 ? 4 : pct <= 5 ? 3 : pct <= 15 ? 2 : pct <= 30 ? 1 : 0;
  return {
    score,
    evidence: `${missingAlt}/${images.length} images (${pct.toFixed(1)}%) missing alt attribute`.slice(0, 300),
    evidence_source: 'dom.image-alt',
    severity: 4 - score,
    suggested_fix: score < 4 ? 'Add descriptive alt text to images missing alt attributes'.slice(0, 280) : '',
    location: null,
  };
}

// dom.form-labels: Check form inputs have associated labels
export function checkFormLabels(html: string): StructuralCheckResult {
  const inputRegex = /<input[^>]*type\s*=\s*["'](?!hidden|submit|button|reset|image)[^"']*["'][^>]*>/gi;
  const inputs: string[] = [];
  let match;
  while ((match = inputRegex.exec(html)) !== null) inputs.push(match[0]);

  // Also match inputs without explicit type (default text)
  const defaultInputRegex = /<input(?![^>]*type\s*=)[^>]*>/gi;
  while ((match = defaultInputRegex.exec(html)) !== null) inputs.push(match[0]);

  if (inputs.length === 0) {
    return { score: 4, evidence: 'No form inputs found', evidence_source: 'dom.form-labels', severity: 0, suggested_fix: '', location: null };
  }

  let unlabeled = 0;
  for (const input of inputs) {
    const hasAriaLabel = /aria-label\s*=/i.test(input);
    const hasAriaLabelledBy = /aria-labelledby\s*=/i.test(input);
    const hasId = /\sid\s*=\s*["']([^"']+)["']/i.exec(input);

    if (!hasAriaLabel && !hasAriaLabelledBy) {
      if (!hasId || !new RegExp(`<label[^>]*for\\s*=\\s*["']${hasId[1]}["']`, 'i').test(html)) {
        unlabeled++;
      }
    }
  }

  const pct = (unlabeled / inputs.length) * 100;
  const score = pct === 0 ? 4 : pct <= 5 ? 3 : pct <= 15 ? 2 : pct <= 30 ? 1 : 0;
  return {
    score,
    evidence: `${unlabeled}/${inputs.length} inputs (${pct.toFixed(1)}%) without associated labels`.slice(0, 300),
    evidence_source: 'dom.form-labels',
    severity: 4 - score,
    suggested_fix: score < 4 ? 'Associate labels with all form inputs using <label for> or aria-label'.slice(0, 280) : '',
    location: null,
  };
}

// dom.meta-viewport: Check for proper mobile viewport meta tag
export function checkMetaViewport(html: string): StructuralCheckResult {
  const metaMatch = /<meta[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i.exec(html)
    || /<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']viewport["'][^>]*>/i.exec(html);

  if (!metaMatch) {
    return { score: 0, evidence: 'No viewport meta tag found', evidence_source: 'dom.meta-viewport', severity: 4, suggested_fix: "Add <meta name='viewport' content='width=device-width, initial-scale=1'>", location: null };
  }

  const content = metaMatch[1];
  const hasWidth = /width\s*=\s*device-width/i.test(content);
  const hasInitialScale = /initial-scale\s*=\s*1/i.test(content);

  let score: number;
  if (hasWidth && hasInitialScale) score = 4;
  else if (hasWidth) score = 3;
  else if (content.includes('width')) score = 2;
  else score = 1;

  return {
    score,
    evidence: `Viewport meta: content="${content}"`.slice(0, 300),
    evidence_source: 'dom.meta-viewport',
    severity: 4 - score,
    suggested_fix: score < 4 ? "Add <meta name='viewport' content='width=device-width, initial-scale=1'>".slice(0, 280) : '',
    location: null,
  };
}
