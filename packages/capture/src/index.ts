import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { launchBrowser, closeBrowser } from './browser.js';
import { waitForSettle } from './settle.js';
import { detectAuthWall } from './auth-detect.js';
import { captureScreenshots, DEFAULT_VIEWPORTS, type ViewportSpec } from './screenshot.js';
import { captureDomSnapshot } from './dom.js';
import { readHarFile } from './har.js';
import { captureComputedStyles, type ComputedStylesSnapshot } from './styles.js';
import { captureElementLocations, type ElementLocation } from './element-locator.js';
import { setupConsoleCapture, type CapturedConsoleEntry } from './console.js';

// FR-007a: Default consent banner dismiss selectors
const DEFAULT_DISMISS_SELECTORS = [
  '[aria-label*="accept" i][aria-label*="cookie" i]',
  '#onetrust-accept-btn-handler',
  '.cookie-accept',
  '.cc-accept',
  '[data-testid="cookie-accept"]',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '.js-cookie-consent-agree',
  '#accept-cookies',
  'button[data-cookiefirst-action="accept"]',
];

export interface CaptureOptions {
  settleTimeoutMs?: number;
  additionalSettleDelay?: number;
  viewports?: ViewportSpec[];
  deviceScaleFactor?: number;
  dismissSelectors?: string[];
  autoDismiss?: boolean;
}

export interface CaptureResult {
  url: string;
  captured_at: string;
  content_hash: string;
  viewports_captured: string[];
  screenshots: Map<string, Buffer>;
  dom_snapshot: string;
  computed_styles: ComputedStylesSnapshot;
  element_locations: ElementLocation[];
  console_errors: CapturedConsoleEntry[];
  har: unknown;
}

async function dismissConsentBanners(page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        // Wait up to 2 seconds for overlay to disappear
        await page.waitForTimeout(2000);
        return;
      }
    } catch {
      // Selector didn't match or click failed — continue silently
    }
  }
}

/** Capture a full page snapshot: screenshots, DOM, HAR, styles, and console errors. */
export async function capturePage(
  url: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const viewports = options.viewports ?? DEFAULT_VIEWPORTS;
  const autoDismiss = options.autoDismiss ?? true;
  const dismissSelectors = options.dismissSelectors ?? DEFAULT_DISMISS_SELECTORS;

  // Create temp dir for HAR
  const tempDir = await mkdtemp(join(tmpdir(), 'webui-rubric-'));
  const harPath = join(tempDir, 'recording.har');

  const session = await launchBrowser({
    harPath,
    viewportWidth: viewports[0]?.width ?? 1280,
    viewportHeight: viewports[0]?.height ?? 800,
    deviceScaleFactor: options.deviceScaleFactor ?? 1,
  });

  try {
    // 1. Setup console capture before navigation
    const consoleErrors = setupConsoleCapture(session.page);

    // 2. Navigate (single navigation — no double goto)
    const response = await session.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: options.settleTimeoutMs ?? 30000,
    });

    // 3. Wait for settle (networkidle + additional delay, no navigation)
    await waitForSettle(session.page, {
      timeout: options.settleTimeoutMs,
      additionalDelay: options.additionalSettleDelay,
    });

    // 4. Check for auth wall using the response from the initial navigation
    const authResult = await detectAuthWall(session.page, url, response);
    if (authResult.detected) {
      throw new Error(`Authentication wall detected: ${authResult.reason}`);
    }

    // 5. Auto-dismiss consent banners
    if (autoDismiss) {
      await dismissConsentBanners(session.page, dismissSelectors);
    }

    // 6. Inject stabilization CSS and capture screenshots
    const screenshots = await captureScreenshots(session.page, viewports);

    // 7. Capture DOM snapshot and computed styles
    const dom_snapshot = await captureDomSnapshot(session.page);
    const computed_styles = await captureComputedStyles(session.page);

    // 8. Capture element locations (while browser is still alive)
    const element_locations = await captureElementLocations(session.page);

    // 9. Close context to finalize HAR
    await session.context.close();

    // Read HAR
    let har: unknown = null;
    try {
      har = await readHarFile(harPath);
    } catch {
      // HAR may not exist if recording failed
    }

    // Compute content hash
    const hashInput = [
      dom_snapshot,
      JSON.stringify(Object.fromEntries(screenshots.entries())),
      JSON.stringify(consoleErrors),
    ].join('\n');
    const content_hash = createHash('sha256').update(hashInput).digest('hex');

    // Clean up temp dir and close browser
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await session.browser.close();

    return {
      url,
      captured_at: new Date().toISOString(),
      content_hash,
      viewports_captured: viewports.map((v) => v.name),
      screenshots,
      dom_snapshot,
      computed_styles,
      element_locations,
      console_errors: consoleErrors,
      har,
    };
  } catch (error) {
    await closeBrowser(session).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

// Re-export types for consumers
export type { BrowserSession } from './browser.js';
export type { ViewportSpec } from './screenshot.js';
export type { CapturedConsoleEntry } from './console.js';
export type { ComputedStylesSnapshot } from './styles.js';
export type { AuthDetectionResult } from './auth-detect.js';
export type { SettleOptions } from './settle.js';
export { DEFAULT_VIEWPORTS } from './screenshot.js';
export { launchBrowser, closeBrowser } from './browser.js';
export { waitForSettle } from './settle.js';
export { detectAuthWall } from './auth-detect.js';
export { captureScreenshots, injectStabilizationCSS } from './screenshot.js';
export { captureDomSnapshot } from './dom.js';
export { readHarFile } from './har.js';
export { captureComputedStyles } from './styles.js';
export { captureElementLocations, type ElementLocation } from './element-locator.js';
export { setupConsoleCapture } from './console.js';
export {
  loadReferenceImage,
  inferDpr,
  validateReferenceDimensions,
  normalizeRgbaBuffer,
  type ReferenceImageInfo,
} from './reference-image.js';
export {
  resolveMaskSelectors,
  applyMaskToPng,
  countMaskedPixels,
  parseMaskColor,
  type MaskRegion,
} from './mask.js';
