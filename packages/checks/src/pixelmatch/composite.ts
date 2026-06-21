import { PNG } from 'pngjs';

/** Width in pixels of the gutter drawn between panels of a composite image. */
const GUTTER = 8;

/** RGBA of the gutter/background fill (light gray). */
const GUTTER_FILL: [number, number, number, number] = [221, 221, 221, 255];

/** RGBA of the label band drawn above each panel (dark slate). */
const LABEL_BG: [number, number, number, number] = [30, 41, 59, 255];

/** Height in pixels of the label band above each panel. */
const LABEL_HEIGHT = 18;

function fillRect(
  png: PNG,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rgba: [number, number, number, number],
): void {
  for (let y = y0; y < y0 + h && y < png.height; y++) {
    for (let x = x0; x < x0 + w && x < png.width; x++) {
      const idx = (y * png.width + x) * 4;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
}

/**
 * Stitch the reference, screenshot, and diff PNGs horizontally into a single
 * composite image, always in the order reference | screenshot | diff (documented
 * in the manifest and report caption). The three inputs must share identical
 * dimensions (guaranteed by the dimension-match check upstream). A colored band
 * is drawn above each panel as a visual separator.
 */
export function buildSideBySide(
  referenceBuffer: Buffer,
  screenshotBuffer: Buffer,
  diffBuffer: Buffer,
): Buffer {
  const reference = PNG.sync.read(referenceBuffer);
  const screenshot = PNG.sync.read(screenshotBuffer);
  const diff = PNG.sync.read(diffBuffer);

  const panelW = reference.width;
  const panelH = reference.height;
  const totalW = panelW * 3 + GUTTER * 2;
  const totalH = panelH + LABEL_HEIGHT;

  const out = new PNG({ width: totalW, height: totalH });
  fillRect(out, 0, 0, totalW, totalH, GUTTER_FILL);

  const panels: Array<{ png: PNG; x: number }> = [
    { png: reference, x: 0 },
    { png: screenshot, x: panelW + GUTTER },
    { png: diff, x: (panelW + GUTTER) * 2 },
  ];

  for (const { png, x } of panels) {
    // Label band above the panel.
    fillRect(out, x, 0, panelW, LABEL_HEIGHT, LABEL_BG);
    // Panel image below the label band.
    PNG.bitblt(png, out, 0, 0, panelW, panelH, x, LABEL_HEIGHT);
  }

  return PNG.sync.write(out);
}

/**
 * Crop a full-width horizontal strip [yStart, yEnd) from a PNG buffer. Diff
 * regions are horizontal bands, so this isolates the rows that changed most.
 */
export function cropStrip(sourceBuffer: Buffer, yStart: number, yEnd: number): Buffer {
  const source = PNG.sync.read(sourceBuffer);
  const top = Math.max(0, Math.min(yStart, source.height));
  const bottom = Math.max(top, Math.min(yEnd, source.height));
  const height = Math.max(1, bottom - top);

  const out = new PNG({ width: source.width, height });
  PNG.bitblt(source, out, 0, top, source.width, height, 0, 0);
  return PNG.sync.write(out);
}
