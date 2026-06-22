---
'@webui-rubric/cli': patch
'@webui-rubric/core': patch
---

Fix `--artifact-dir` producing no bundle when the reference image dimensions do not match the captured screenshot.

Previously, a reference/screenshot dimension mismatch took a branch that never populated the artifact viewport inputs, so `--artifact-dir` silently wrote nothing and logged a misleading warning claiming `--reference` was not supplied. Now the bundle is always written when `--reference` is given: on a mismatch it contains the reference and screenshot images plus a manifest entry marked `compared: false` with a `note` explaining the gap, while `diff`/`composite` are `null` (they require equal dimensions). The HTML report shows the two source images side by side with a "Pixel comparison unavailable" note instead of a broken composite. The misleading skip warning now distinguishes "no reference supplied" from "no viewport could be compared".
