---
"@webui-rubric/capture": minor
"@webui-rubric/cli": minor
"@webui-rubric/core": minor
"@webui-rubric/checks": minor
---

Make the Playwright capture engine configurable instead of Chromium-only.

- `@webui-rubric/capture`: `launchBrowser`/`capturePage` accept a `browser` option (`'chromium' | 'firefox' | 'webkit'`, default `'chromium'`) via the new `BrowserEngine` type. Adds a `chromiumExecutablePath()` helper exposing Playwright's bundled Chromium path.
- `@webui-rubric/cli`: new `--browser <engine>` flag (precedence: CLI flag > `capture.browser` config > `chromium`) with validation. When Lighthouse/Chromium is unavailable, the CLI now logs a clear degradation warning explaining that the performance dimension will be scored from resource-efficiency only.
- `@webui-rubric/core`: `CaptureConfig` / config schema gain an optional `browser` field.
- `@webui-rubric/checks`: `runLighthouseChecks` points `chrome-launcher` at Playwright's bundled Chromium (via `chromiumExecutablePath()`), so performance metrics keep working regardless of the selected capture engine, and degrade gracefully when Chromium can't run.
