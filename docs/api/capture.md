# Capture API Reference

`@webui-rubric/capture` — browser capture pipeline: screenshots, DOM
snapshots, HAR network logs, computed styles, and console entries.

**Source:** `packages/capture/src/`

---

## Exports overview

### Main pipeline (`index.ts`)

| Export | Description |
|---|---|
| `capturePage(url, options?)` | Launch a browser, navigate to a URL, and return a `CaptureResult` containing all captured artifacts. |
| `CaptureOptions` | Options for the capture pipeline (viewports, settle timeout, consent-banner selectors). |
| `CaptureResult` | Container for all captured artifacts: screenshots, DOM, HAR, styles, console, element locations. |

`CaptureOptions` fields:

| Field | Default | Description |
|---|---|---|
| `settleTimeoutMs` | `5000` | Maximum time (ms) to wait for the page to settle after load. |
| `additionalSettleDelay` | `0` | Extra delay (ms) after the settle check passes. |
| `viewports` | `DEFAULT_VIEWPORTS` | Array of `ViewportSpec` to capture. |
| `deviceScaleFactor` | `1` | CSS pixel ratio. |
| `dismissSelectors` | *(built-in list)* | Selectors for cookie/consent banners to auto-dismiss (FR-007a). |
| `autoDismiss` | `true` | Whether to attempt consent-banner dismissal before capture. |

---

### Screenshots (`screenshot.ts`)

| Export | Description |
|---|---|
| `captureScreenshots(page, viewports)` | Capture PNG screenshots at each viewport; returns `Map<name, Buffer>`. |
| `injectStabilizationCSS(page)` | Freeze animations, transitions, and scrollbars before capture (FR-007). |
| `DEFAULT_VIEWPORTS` | Default viewport list: `desktop` (1280×800), `above-fold` (1280×800), `mobile` (375×812). |
| `ViewportSpec` | `{ name, width, height, fullPage? }` — describes a single capture viewport. |

`injectStabilizationCSS` sets all animation/transition durations to `0s` and
hides scrollbars so screenshots are pixel-stable across runs.

---

### DOM Snapshot (`dom.ts`)

| Export | Description |
|---|---|
| `captureDomSnapshot(page)` | Return the full outer HTML of the current page (`page.content()`). |

The raw HTML string is subsequently passed through `redactDomSnapshot` in the
evaluate pipeline before being embedded in evidence.

---

### HAR (`har.ts`)

| Export | Description |
|---|---|
| `readHarFile(harPath)` | Read and JSON-parse a HAR 1.2 file from disk; returns the parsed object. |

HAR recording is enabled via Playwright's `context.newPage({ recordHar })` in
the capture pipeline; `readHarFile` is used to retrieve it after the page is
closed.

---

### Computed Styles (`styles.ts`)

| Export | Description |
|---|---|
| `captureComputedStyles(page, selectors?)` | Evaluate `getComputedStyle` on matched elements; returns `ComputedStylesSnapshot`. |
| `ComputedStylesSnapshot` | Map of CSS selector → computed style property bag. |

---

### Console Capture (`console.ts`)

| Export | Description |
|---|---|
| `setupConsoleCapture(page)` | Attach a `console` listener before navigation; returns a `CapturedConsoleEntry[]` accumulator. |
| `CapturedConsoleEntry` | `{ type, text, timestamp }` — a single console message. |

---

### Element Locator (`element-locator.ts`)

| Export | Description |
|---|---|
| `captureElementLocations(page, selectors)` | Return bounding-box data for matched elements. |
| `ElementLocation` | `{ selector, boundingBox }` describing an element's position. |

---

## Usage example

```ts
import { capturePage, DEFAULT_VIEWPORTS } from '@webui-rubric/capture';

const result = await capturePage('https://example.com', {
  viewports: DEFAULT_VIEWPORTS,
  settleTimeoutMs: 8000,
  autoDismiss: true,
});

// result.screenshots — Map<string, Buffer>
// result.domSnapshot  — string (full HTML)
// result.har          — HAR 1.2 object
// result.consoleEntries — CapturedConsoleEntry[]
```

**Source:** `packages/capture/src/`
