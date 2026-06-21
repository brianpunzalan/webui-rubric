# @webui-rubric/capture

Playwright-based headless browser capture pipeline for `webui-rubric`. Navigates to a live URL, injects a CSS stabilization stylesheet to freeze animations and transitions, waits for network idle, auto-dismisses cookie consent banners, and captures screenshots at all configured viewports. Also records a HAR file, snapshots the full rendered DOM, extracts computed CSS properties per element, tracks element bounding boxes, and collects console errors. Provides reference image loading, DPR inference, and pixel masking utilities consumed by `@webui-rubric/checks`.

## Installation

```bash
npm install @webui-rubric/capture
# or
pnpm add @webui-rubric/capture
```

After installing, install the Chromium browser binary:

```bash
npx playwright install chromium
```

## Dependencies

| Dependency             | Version       | Purpose                                                                   |
| ---------------------- | ------------- | ------------------------------------------------------------------------- |
| `playwright`           | `^1.48.0`     | Headless Chromium browser automation, HAR recording                       |
| `@axe-core/playwright` | `^4.10.0`     | axe-core integration (available for checks to inject)                     |
| `pngjs`                | `^7.0.0`      | PNG parsing for reference images and masking                              |
| `@webui-rubric/core`   | `workspace:*` | Shared types (`ComputedStylesSnapshot`, `ConsoleEntry`, `ViewportConfig`) |

## Package Interactions

```
@webui-rubric/capture
└── @webui-rubric/core    (types only — ComputedStylesSnapshot, ConsoleEntry, etc.)

Consumed by:
  @webui-rubric/checks   (uses ElementLocation in mapDiffRegionsToElements)
  @webui-rubric/cli      (calls capturePage, loadReferenceImage, inferDpr)
```

The primary consumer is `@webui-rubric/cli`, which calls `capturePage` and then passes the resulting artifacts to `@webui-rubric/checks` for scoring. `@webui-rubric/checks` also imports `ElementLocation` to map pixel diff regions back to DOM elements.

---

## API Reference

### Primary function

#### `capturePage(url, options?): Promise<CaptureResult>`

Runs the full capture pipeline in a single call. Launches a headless Chromium browser, navigates to `url`, stabilizes the page, optionally dismisses consent banners, and captures all artifacts before closing the browser.

**`CaptureOptions`:**

```typescript
interface CaptureOptions {
  settleTimeoutMs?: number; // Network-idle + navigation timeout. Default: 30000ms
  additionalSettleDelay?: number; // Extra wait after networkidle. Default: 5000ms
  viewports?: ViewportSpec[]; // Viewports to capture. Default: DEFAULT_VIEWPORTS
  deviceScaleFactor?: number; // Device pixel ratio (e.g. 2 for Retina). Default: 1
  dismissSelectors?: string[]; // CSS selectors for consent banner dismiss buttons
  autoDismiss?: boolean; // Auto-click consent banners. Default: true
}
```

**`CaptureResult`:**

```typescript
interface CaptureResult {
  url: string;
  captured_at: string; // ISO 8601 timestamp
  content_hash: string; // SHA-256 of DOM + screenshots + console errors
  viewports_captured: string[]; // Names of viewports that were captured
  screenshots: Map<string, Buffer>; // Viewport name → PNG buffer
  dom_snapshot: string; // Full rendered HTML (page.content())
  computed_styles: ComputedStylesSnapshot; // selector → { property: value }
  element_locations: ElementLocation[]; // Bounding boxes + tagName + styles per element
  console_errors: CapturedConsoleEntry[]; // console.error / console.warn messages
  har: unknown; // HAR 1.2 JSON object, or null if recording failed
}
```

**Capture sequence (in order):**

1. Create temp directory for HAR recording
2. Launch Chromium with HAR recording enabled
3. Install `console` event listener before navigation
4. Navigate to `url` with `waitUntil: 'domcontentloaded'`
5. `waitForSettle` — network idle + `additionalSettleDelay`
6. `detectAuthWall` — abort with error if login redirect detected
7. `dismissConsentBanners` — click first matching dismiss selector (if `autoDismiss`)
8. `injectStabilizationCSS` + `captureScreenshots` at each viewport
9. `captureDomSnapshot`, `captureComputedStyles`, `captureElementLocations`
10. Close browser context to finalize HAR file
11. Read and parse HAR; compute `content_hash`; clean up temp dir

**Throws** on auth wall detection, navigation timeout, or page-settle timeout.

```typescript
import { capturePage } from '@webui-rubric/capture';

const result = await capturePage('https://example.com', {
  settleTimeoutMs: 30000,
  additionalSettleDelay: 3000,
  deviceScaleFactor: 1,
});

console.log(result.content_hash);
console.log([...result.screenshots.keys()]); // ['desktop', 'mobile']
```

---

### Browser lifecycle

#### `launchBrowser(options?): Promise<BrowserSession>`

Launches a headless Chromium instance and returns a session with `browser`, `context`, and `page`. Optionally enables HAR recording on the context.

```typescript
interface BrowserOptions {
  harPath?: string; // If set, enables recordHar on the context
  viewportWidth?: number; // Default: 1280
  viewportHeight?: number; // Default: 800
  deviceScaleFactor?: number; // Default: 1
}

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}
```

```typescript
import { launchBrowser, closeBrowser } from '@webui-rubric/capture';

const session = await launchBrowser({ harPath: '/tmp/recording.har' });
// ... use session.page
await closeBrowser(session);
```

#### `closeBrowser(session): Promise<void>`

Closes the browser context and browser. Safe to call even if the session is in an error state.

---

### Page settlement

#### `waitForSettle(page, options?): Promise<void>`

Waits for the page to reach network idle, then waits an additional `additionalDelay` milliseconds for late JavaScript activity to complete.

```typescript
interface SettleOptions {
  timeout?: number; // Total timeout in ms. Default: 30000
  additionalDelay?: number; // Extra wait after networkidle. Default: 0
}
```

```typescript
import { waitForSettle } from '@webui-rubric/capture';

await waitForSettle(page, { timeout: 30000, additionalDelay: 5000 });
```

---

### Authentication wall detection

#### `detectAuthWall(page, url, response): Promise<AuthDetectionResult>`

Detects whether the page has redirected to a login or authentication page. Checks for URL pattern matches on the final URL (`/login`, `/signin`, `/auth`, etc.) and HTTP error response codes (4xx/5xx).

```typescript
interface AuthDetectionResult {
  detected: boolean;
  reason: string; // Human-readable explanation when detected
}
```

```typescript
import { detectAuthWall } from '@webui-rubric/capture';

const result = await detectAuthWall(page, originalUrl, navigationResponse);
if (result.detected) throw new Error(`Auth wall: ${result.reason}`);
```

---

### Screenshots

#### `captureScreenshots(page, viewports): Promise<Map<string, Buffer>>`

Injects the stabilization CSS stylesheet, then captures a screenshot at each viewport. Returns a `Map` keyed by viewport name, values are PNG buffers.

**Stabilization CSS (always-on):** Forces `animation-duration: 0s`, `animation-delay: 0s`, `transition-duration: 0s`, `transition-delay: 0s`, `caret-color: transparent`, `scroll-behavior: auto`, hides scrollbars, and scrolls to top before every capture. This is a prerequisite for deterministic pixel comparison.

```typescript
import { captureScreenshots, DEFAULT_VIEWPORTS } from '@webui-rubric/capture';

const screenshots = await captureScreenshots(page, DEFAULT_VIEWPORTS);
const desktopPng = screenshots.get('desktop'); // Buffer
```

#### `injectStabilizationCSS(page): Promise<void>`

Injects the stabilization stylesheet into the page. Called automatically by `captureScreenshots`. Can also be called independently.

#### `DEFAULT_VIEWPORTS`

```typescript
const DEFAULT_VIEWPORTS: ViewportSpec[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];
```

#### `ViewportSpec`

```typescript
interface ViewportSpec {
  name: string;
  width: number;
  height: number;
  fullPage?: boolean;
}
```

---

### DOM and computed styles

#### `captureDomSnapshot(page): Promise<string>`

Returns the full rendered HTML of the page (`page.content()`), including dynamically added elements and computed attribute values.

#### `captureComputedStyles(page): Promise<ComputedStylesSnapshot>`

Extracts computed CSS properties for every visible element on the page. Returns a `ComputedStylesSnapshot` (`Record<selector, Record<property, value>>`). Used by CSS structural checks in `@webui-rubric/checks`.

#### `captureElementLocations(page): Promise<ElementLocation[]>`

Walks the DOM and records the bounding box, tag name, and key computed styles for every visible element. Used by `mapDiffRegionsToElements` in `@webui-rubric/checks` to link pixel diff regions back to DOM elements.

```typescript
interface ElementLocation {
  selector: string;
  bbox: { x: number; y: number; width: number; height: number };
  tagName: string;
  computedStyles: Record<string, string>;
}
```

---

### Console capture

#### `setupConsoleCapture(page): CapturedConsoleEntry[]`

Installs a `console` event listener on the page before navigation begins. Returns a live-updating array; add it to the capture result after navigation is complete.

**Must be called before `page.goto()`** to capture errors emitted during initial load.

```typescript
interface CapturedConsoleEntry {
  level: 'error' | 'warning';
  text: string;
  url: string | null; // Source URL if available
  line: number | null; // Line number if available
}
```

```typescript
import { setupConsoleCapture } from '@webui-rubric/capture';

const consoleErrors = setupConsoleCapture(page);
await page.goto(url);
// consoleErrors is now populated with any errors/warnings emitted during load
```

---

### HAR recording

#### `readHarFile(path): Promise<unknown>`

Reads and parses a HAR 1.2 JSON file. Returns the raw parsed object.

HAR recording is enabled at the `BrowserContext` level by `launchBrowser` when `harPath` is set. The HAR is only finalized (flushed to disk) after `context.close()` is called.

---

### Reference image utilities

These are used by `@webui-rubric/cli` and `@webui-rubric/checks` for pixel comparison.

#### `loadReferenceImage(path): ReferenceImageInfo`

Reads a PNG reference image from disk synchronously. Returns metadata including the raw buffer and parsed PNG object.

```typescript
interface ReferenceImageInfo {
  path: string;
  buffer: Buffer; // Raw file bytes
  png: PNG; // Parsed pngjs object (has .data, .width, .height)
  width: number;
  height: number;
}
```

```typescript
import { loadReferenceImage } from '@webui-rubric/capture';

const ref = loadReferenceImage('./designs/homepage.png');
console.log(`${ref.width}×${ref.height}`);
```

#### `inferDpr(refWidth, refHeight, vpWidth, vpHeight): number`

Infers the device pixel ratio from a reference image's pixel dimensions relative to the viewport.

```typescript
import { inferDpr } from '@webui-rubric/capture';

inferDpr(2560, 1600, 1280, 800); // 2  (Retina)
inferDpr(1280, 800, 1280, 800); // 1  (standard)
```

#### `validateReferenceDimensions(ref, vpWidth, vpHeight, dpr): boolean`

Checks that the reference image's dimensions match the expected screenshot dimensions at the given DPR. Returns `true` when `ref.width === vpWidth * dpr && ref.height === vpHeight * dpr`.

#### `normalizeRgbaBuffer(png): Buffer`

Normalizes a PNG's data to a flat RGBA buffer suitable for `pixelmatch`. Handles both RGB and RGBA source images by filling transparent pixels with opaque white.

---

### Pixel masking

Used to block out dynamic content (carousels, ads, timestamps) before pixel comparison so they don't inflate the diff ratio.

#### `resolveMaskSelectors(page, selectors): Promise<MaskRegion[]>`

Resolves CSS selectors against the live DOM and returns bounding boxes for all matching elements.

```typescript
interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

#### `applyMaskToPng(buffer, regions, color): Buffer`

Paints each mask region with a solid color on a copy of the PNG. Returns the masked buffer. The same mask must be applied to both the screenshot and the reference image before calling `pixelmatch`.

#### `countMaskedPixels(buffer, color): number`

Counts pixels in a buffer that exactly match the mask color. Useful for verifying mask coverage.

#### `parseMaskColor(color): [r, g, b]`

Parses a hex color string (`#FF00FF`, `#808080`) into a `[r, g, b]` tuple.

---

## Behavioral Notes

### CSS Stabilization

The stabilization stylesheet is injected before every screenshot capture and is **always on** — it cannot be disabled. It sets:

```css
*,
*::before,
*::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
/* also hides scrollbars and scrolls to (0, 0) */
```

This is a prerequisite for deterministic pixel comparison (FR-003) and for meaningful diffs against reference images.

### Cookie Banner Auto-Dismiss

When `autoDismiss: true` (the default), the pipeline iterates through `dismissSelectors` and clicks the first matching element. It then waits up to 2 seconds for the overlay to disappear before proceeding. If no selector matches, it continues silently.

**Default dismiss selectors:**

- `[aria-label*="accept" i][aria-label*="cookie" i]`
- `#onetrust-accept-btn-handler`
- `.cookie-accept`
- `.cc-accept`
- `[data-testid="cookie-accept"]`
- `#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll`
- `.js-cookie-consent-agree`
- `#accept-cookies`
- `button[data-cookiefirst-action="accept"]`

Pass `dismissSelectors` in options to extend or replace this list. Set `autoDismiss: false` to disable entirely.

---

## Usage Example

```typescript
import { capturePage, DEFAULT_VIEWPORTS } from '@webui-rubric/capture';

async function run() {
  const result = await capturePage('https://example.com', {
    settleTimeoutMs: 30000,
    additionalSettleDelay: 5000,
    viewports: DEFAULT_VIEWPORTS,
    deviceScaleFactor: 1,
    autoDismiss: true,
  });

  console.log('Captured at:', result.captured_at);
  console.log('Content hash:', result.content_hash);
  console.log('Viewports:', result.viewports_captured);
  console.log('DOM length:', result.dom_snapshot.length);
  console.log('Console errors:', result.console_errors.length);

  // Access the desktop screenshot PNG buffer
  const desktopPng = result.screenshots.get('desktop');

  // Pass artifacts to @webui-rubric/checks
  // checkHeadingOrder(result.dom_snapshot)
  // checkUniqueColorCount(result.computed_styles)
  // checkConsoleErrors(result.console_errors)
}
```
