---
'@webui-rubric/cli': patch
'@webui-rubric/core': patch
---

Fix `--artifact-dir` producing no bundle in cases where a reference image could not be compared, and always emit a bundle when `--artifact-dir` is supplied.

Previously, a reference/screenshot dimension mismatch took a branch that never populated the artifact viewport inputs, so `--artifact-dir` silently wrote nothing and logged a misleading warning claiming `--reference` was not supplied. Two changes:

- On a dimension mismatch the bundle is now written with the reference and screenshot images plus a manifest entry marked `compared: false` with a `note` explaining the gap, while `diff`/`composite` are `null` (they require equal dimensions). The HTML report shows the two source images side by side with a "Pixel comparison unavailable" note instead of a broken composite.
- Without `--reference`, `--artifact-dir` now writes a data-only bundle (`manifest.json` + `report.html` with scores, verdict, top issues and iteration context; `artifact.viewports` is an empty array and no image artifacts are produced) instead of skipping generation.
