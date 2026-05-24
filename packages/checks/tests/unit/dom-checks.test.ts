import { describe, it, expect } from 'vitest';
import {
  checkHeadingOrder,
  checkLandmarkUsage,
  checkLinkDescriptiveness,
  checkImageAlt,
  checkFormLabels,
  checkMetaViewport,
} from '../../src/structural/dom-checks.js';

describe('checkHeadingOrder', () => {
  it('returns score 4 when no headings exist', () => {
    const result = checkHeadingOrder('<div>no headings</div>');
    expect(result.score).toBe(4);
    expect(result.evidence_source).toBe('dom.heading-order');
  });

  it('returns score 4 for proper h1 -> h2 -> h3 hierarchy', () => {
    const html = '<h1>Title</h1><h2>Section</h2><h3>Subsection</h3>';
    const result = checkHeadingOrder(html);
    expect(result.score).toBe(4);
    expect(result.severity).toBe(0);
    expect(result.suggested_fix).toBe('');
  });

  it('returns score 4 when heading level goes down (h3 -> h1 is not a skip)', () => {
    const html = '<h1>Title</h1><h2>A</h2><h3>B</h3><h1>Next</h1><h2>C</h2>';
    const result = checkHeadingOrder(html);
    expect(result.score).toBe(4);
  });

  it('returns score 3 for a single skipped level (h1 -> h3)', () => {
    const html = '<h1>Title</h1><h3>Subsection</h3>';
    const result = checkHeadingOrder(html);
    expect(result.score).toBe(3);
    expect(result.severity).toBe(1);
    expect(result.suggested_fix).toContain('1 violations');
  });

  it('returns score 2 for two skipped levels', () => {
    const html = '<h1>A</h1><h3>B</h3><h1>C</h1><h4>D</h4>';
    const result = checkHeadingOrder(html);
    expect(result.score).toBe(2);
    expect(result.severity).toBe(2);
  });

  it('returns score 1 for three to five skips', () => {
    const html = '<h1>A</h1><h3>B</h3><h1>C</h1><h3>D</h3><h1>E</h1><h3>F</h3>';
    const result = checkHeadingOrder(html);
    expect(result.score).toBe(1);
  });

  it('returns score 0 for more than five skips', () => {
    // 6 skips: each h1->h3 is one skip
    const pairs = Array.from({ length: 6 }, (_, i) => `<h1>T${i}</h1><h3>S${i}</h3>`).join('');
    const result = checkHeadingOrder(pairs);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('always returns evidence_source dom.heading-order', () => {
    const result = checkHeadingOrder('<h1>X</h1><h4>Y</h4>');
    expect(result.evidence_source).toBe('dom.heading-order');
  });

  it('sets location to null', () => {
    const result = checkHeadingOrder('<h1>X</h1>');
    expect(result.location).toBeNull();
  });
});

describe('checkLandmarkUsage', () => {
  it('returns score 4 when all 4 landmarks are present', () => {
    const html = '<header>H</header><nav>N</nav><main>M</main><footer>F</footer>';
    const result = checkLandmarkUsage(html);
    expect(result.score).toBe(4);
    expect(result.severity).toBe(0);
    expect(result.suggested_fix).toBe('');
  });

  it('returns score 3 for 3 landmarks', () => {
    const html = '<header>H</header><nav>N</nav><main>M</main>';
    const result = checkLandmarkUsage(html);
    expect(result.score).toBe(3);
  });

  it('returns score 2 for 2 landmarks', () => {
    const html = '<header>H</header><main>M</main>';
    const result = checkLandmarkUsage(html);
    expect(result.score).toBe(2);
  });

  it('returns score 1 for 1 landmark', () => {
    const html = '<main>M</main>';
    const result = checkLandmarkUsage(html);
    expect(result.score).toBe(1);
  });

  it('returns score 0 when no landmarks exist', () => {
    const result = checkLandmarkUsage('<div>content</div>');
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('detects landmarks case-insensitively', () => {
    const html = '<HEADER>H</HEADER><NAV>N</NAV><MAIN>M</MAIN><FOOTER>F</FOOTER>';
    const result = checkLandmarkUsage(html);
    expect(result.score).toBe(4);
  });

  it('detects landmarks with attributes', () => {
    const html =
      '<header class="x">H</header><nav id="y">N</nav><main role="z">M</main><footer data-a="b">F</footer>';
    const result = checkLandmarkUsage(html);
    expect(result.score).toBe(4);
  });

  it('always returns evidence_source dom.landmark-usage', () => {
    const result = checkLandmarkUsage('<div></div>');
    expect(result.evidence_source).toBe('dom.landmark-usage');
  });
});

describe('checkLinkDescriptiveness', () => {
  it('returns score 4 when no links exist', () => {
    const result = checkLinkDescriptiveness('<div>no links</div>');
    expect(result.score).toBe(4);
    expect(result.evidence).toBe('No links found on page');
  });

  it('returns score 4 when all links have descriptive text', () => {
    const html = '<a href="/about">About our company</a><a href="/contact">Contact us today</a>';
    const result = checkLinkDescriptiveness(html);
    expect(result.score).toBe(4);
    expect(result.suggested_fix).toBe('');
  });

  it('returns low score when links use "click here"', () => {
    const html = '<a href="/a">click here</a><a href="/b">Good link</a>';
    const result = checkLinkDescriptiveness(html);
    // 1/2 = 50%, which yields score 1
    expect(result.score).toBe(1);
  });

  it('detects multiple generic patterns', () => {
    const html = [
      '<a href="/a">click here</a>',
      '<a href="/b">here</a>',
      '<a href="/c">read more</a>',
      '<a href="/d">learn more</a>',
      '<a href="/e">more</a>',
      '<a href="/f">link</a>',
      '<a href="/g">this</a>',
    ].join('');
    const result = checkLinkDescriptiveness(html);
    // 7/7 = 100%, score 0
    expect(result.score).toBe(0);
  });

  it('returns score 0 when all links are generic', () => {
    const html = '<a href="/a">click here</a><a href="/b">read more</a>';
    const result = checkLinkDescriptiveness(html);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('ignores links with empty text content', () => {
    const html = '<a href="/a"></a><a href="/b">Good link</a>';
    const result = checkLinkDescriptiveness(html);
    expect(result.score).toBe(4);
  });

  it('strips nested HTML from link text before checking', () => {
    const html = '<a href="/a"><span>click here</span></a>';
    const result = checkLinkDescriptiveness(html);
    // 1/1 = 100%, score 0
    expect(result.score).toBe(0);
  });

  it('always returns evidence_source dom.link-descriptiveness', () => {
    const result = checkLinkDescriptiveness('<a href="/">Home</a>');
    expect(result.evidence_source).toBe('dom.link-descriptiveness');
  });
});

describe('checkImageAlt', () => {
  it('returns score 4 when no images exist', () => {
    const result = checkImageAlt('<div>no images</div>');
    expect(result.score).toBe(4);
    expect(result.evidence).toBe('No images found on page');
  });

  it('returns score 4 when all images have alt attributes', () => {
    const html = '<img src="a.png" alt="Photo A"><img src="b.png" alt="Photo B">';
    const result = checkImageAlt(html);
    expect(result.score).toBe(4);
    expect(result.suggested_fix).toBe('');
  });

  it('returns proportional score for some missing alt', () => {
    // 1 missing out of 4 = 25%, which is <= 30% => score 1
    const html =
      '<img src="a.png" alt="A"><img src="b.png" alt="B"><img src="c.png" alt="C"><img src="d.png">';
    const result = checkImageAlt(html);
    expect(result.score).toBe(1);
  });

  it('returns score 0 when all images missing alt', () => {
    const html = '<img src="a.png"><img src="b.png">';
    const result = checkImageAlt(html);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('returns score 3 when very few missing (<=5%)', () => {
    // 1 missing out of 20 = 5%
    const withAlt = Array.from({ length: 19 }, (_, i) => `<img src="${i}.png" alt="img">`).join('');
    const html = withAlt + '<img src="no.png">';
    const result = checkImageAlt(html);
    expect(result.score).toBe(3);
  });

  it('detects alt attribute case-insensitively', () => {
    const html = '<img src="a.png" ALT="Photo">';
    const result = checkImageAlt(html);
    expect(result.score).toBe(4);
  });

  it('always returns evidence_source dom.image-alt', () => {
    const result = checkImageAlt('<img src="a.png" alt="ok">');
    expect(result.evidence_source).toBe('dom.image-alt');
  });
});

describe('checkFormLabels', () => {
  it('returns score 4 when no inputs exist', () => {
    const result = checkFormLabels('<div>no forms</div>');
    expect(result.score).toBe(4);
    expect(result.evidence).toBe('No form inputs found');
  });

  it('returns score 4 when all inputs have associated labels via for attribute', () => {
    const html = '<label for="name">Name</label><input type="text" id="name">';
    const result = checkFormLabels(html);
    expect(result.score).toBe(4);
    expect(result.suggested_fix).toBe('');
  });

  it('returns score 4 when inputs have aria-label', () => {
    const html = '<input type="text" aria-label="Name">';
    const result = checkFormLabels(html);
    expect(result.score).toBe(4);
  });

  it('returns score 4 when inputs have aria-labelledby', () => {
    const html = '<span id="lbl">Name</span><input type="text" aria-labelledby="lbl">';
    const result = checkFormLabels(html);
    expect(result.score).toBe(4);
  });

  it('detects unlabeled inputs', () => {
    const html = '<input type="text"><input type="email">';
    const result = checkFormLabels(html);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('ignores hidden, submit, button, reset, and image input types', () => {
    const html =
      '<input type="hidden" value="x"><input type="submit" value="Go"><input type="button" value="Btn"><input type="reset" value="R"><input type="image" src="a.png">';
    const result = checkFormLabels(html);
    expect(result.score).toBe(4);
    expect(result.evidence).toBe('No form inputs found');
  });

  it('counts inputs without type as default text inputs', () => {
    const html = '<input name="search">';
    const result = checkFormLabels(html);
    // This input has no type attribute, treated as text, no label => unlabeled
    expect(result.score).toBe(0);
  });

  it('returns partial score for mixed labeled/unlabeled', () => {
    // Need enough inputs to get a ratio of <= 5% for score 3
    // 1 unlabeled out of 20 = 5%
    const labeled = Array.from(
      { length: 19 },
      (_, i) => `<label for="f${i}">F</label><input type="text" id="f${i}">`,
    ).join('');
    const html = labeled + '<input type="text">';
    const result = checkFormLabels(html);
    expect(result.score).toBe(3);
  });

  it('always returns evidence_source dom.form-labels', () => {
    const result = checkFormLabels('<input type="text">');
    expect(result.evidence_source).toBe('dom.form-labels');
  });
});

describe('checkMetaViewport', () => {
  it('returns score 4 for complete viewport meta tag', () => {
    const html = '<meta name="viewport" content="width=device-width, initial-scale=1">';
    const result = checkMetaViewport(html);
    expect(result.score).toBe(4);
    expect(result.severity).toBe(0);
    expect(result.suggested_fix).toBe('');
  });

  it('returns score 0 when no viewport meta tag exists', () => {
    const html = '<meta charset="utf-8">';
    const result = checkMetaViewport(html);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
    expect(result.evidence).toBe('No viewport meta tag found');
  });

  it('returns score 3 when only width=device-width is present', () => {
    const html = '<meta name="viewport" content="width=device-width">';
    const result = checkMetaViewport(html);
    expect(result.score).toBe(3);
  });

  it('returns score 2 when width is set but not to device-width', () => {
    const html = '<meta name="viewport" content="width=1024">';
    const result = checkMetaViewport(html);
    expect(result.score).toBe(2);
  });

  it('returns score 1 when content exists but has no width', () => {
    const html = '<meta name="viewport" content="initial-scale=1">';
    const result = checkMetaViewport(html);
    // Has initial-scale but no width => score 1
    expect(result.score).toBe(1);
  });

  it('handles reversed attribute order (content before name)', () => {
    const html = '<meta content="width=device-width, initial-scale=1" name="viewport">';
    const result = checkMetaViewport(html);
    expect(result.score).toBe(4);
  });

  it('always returns evidence_source dom.meta-viewport', () => {
    const result = checkMetaViewport('<html></html>');
    expect(result.evidence_source).toBe('dom.meta-viewport');
  });

  it('sets location to null', () => {
    const result = checkMetaViewport('<html></html>');
    expect(result.location).toBeNull();
  });
});
