import type { Page } from 'playwright';

// FR-007: CSS stabilization — freeze animations, transitions, caret, scrollbar
const STABILIZATION_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
::-webkit-scrollbar { display: none !important; }
* { scrollbar-width: none !important; }
::selection { background: transparent !important; }
`;

export interface ViewportSpec {
  name: string;
  width: number;
  height: number;
  fullPage?: boolean;
}

export const DEFAULT_VIEWPORTS: ViewportSpec[] = [
  { name: 'desktop', width: 1280, height: 800, fullPage: false },
  { name: 'above-fold', width: 1280, height: 800, fullPage: false },
  { name: 'mobile', width: 375, height: 812, fullPage: false },
];

export async function injectStabilizationCSS(page: Page): Promise<void> {
  await page.addStyleTag({ content: STABILIZATION_CSS });
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function captureScreenshots(
  page: Page,
  viewports: ViewportSpec[],
): Promise<Map<string, Buffer>> {
  const screenshots = new Map<string, Buffer>();

  // Inject stabilization CSS once
  await injectStabilizationCSS(page);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => window.scrollTo(0, 0));
    // Small delay for viewport to settle
    await page.waitForTimeout(200);

    const buffer = await page.screenshot({
      fullPage: viewport.fullPage ?? false,
      type: 'png',
    });
    screenshots.set(viewport.name, buffer);
  }

  return screenshots;
}
