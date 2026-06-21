# @webui-rubric/checks

## 0.1.10

### Patch Changes

- ### Documentation
  - docs: document --artifact-dir bundle across READMEs (`6fa84b8`)

  ### Chores
  - chore: add changeset for artifact-dir documentation (`318cdf7`)

- 318cdf7: Document the `--artifact-dir` evaluation-results bundle across the package and global READMEs. Adds the `--artifact-dir` option and bundle layout to the CLI docs, documents the new `buildSideBySide`/`cropStrip` exports and `PixelComparisonOutput.diff_buffer` field in `@webui-rubric/checks`, and documents the `ArtifactReference`/`ArtifactViewportImages` types, the optional `artifact` field on `EvaluationResult`, and the `schema_version` 1.1.0 bump in `@webui-rubric/core`.
- Updated dependencies
- Updated dependencies [318cdf7]
  - @webui-rubric/capture@0.1.10
  - @webui-rubric/core@0.1.10

## 0.1.9

### Patch Changes

- ### Other Changes
  - Fix prettier formatting in package READMEs (`e23c580`)
  - Add evaluation-results artifact bundle generation (`96bfce0`)

- Updated dependencies
  - @webui-rubric/capture@0.1.9
  - @webui-rubric/core@0.1.9

## 0.1.8

### Patch Changes

- ### Documentation
  - docs: add detailed README for each package (`f2de5c7`)

- Updated dependencies
  - @webui-rubric/capture@0.1.8
  - @webui-rubric/core@0.1.8

## 0.1.7

### Patch Changes

- ### Bug Fixes
  - fix: correct suggested_fix type from string to string[] in error paths (`3b8ab83`)

  ### Other Changes
  - style: fix prettier formatting in data-model.md (`fad91ff`)

- Updated dependencies
  - @webui-rubric/capture@0.1.7
  - @webui-rubric/core@0.1.7

## 0.1.6

### Patch Changes

- ### Documentation
  - docs: sync documentation with source code (`d02b51a`)

- Updated dependencies
  - @webui-rubric/capture@0.1.6
  - @webui-rubric/core@0.1.6

## 0.1.5

### Patch Changes

- ### Other Changes
  - Add tests for visual parity suggested_fix builder (`a908b87`)
  - Add DPR inference, dimension mismatch handling, and actionable suggested_fix (`c462d24`)
  - Add spatial diff region analysis and DOM element mapping (`f92cd7f`)
  - Add element location capture with bounding boxes and computed styles (`823c60f`)
  - Migrate suggested_fix from string to string[] across all packages (`fd5a9b5`)
  - Relax score-4 threshold from exact 0% to ≤0.5% pixel diff (`7594d93`)

- Updated dependencies
  - @webui-rubric/capture@0.1.5
  - @webui-rubric/core@0.1.5

## 0.1.4

### Patch Changes

- ### Bug Fixes
  - fix: pass config viewports to capturePage to match reference image dimensions (`ce01f83`)
  - fix: use const for non-reassigned pixel comparison variables (`97d2774`)
  - fix: wire --reference flag into evaluate command for pixel comparison (`33fc4d4`)

  ### Chores
  - chore: add husky and lint-staged for pre-commit autofix (`a076099`)

  ### Other Changes
  - test: add viewport forwarding tests for evaluate command (`694e9d4`)
  - style: fix prettier formatting (`7b6f438`)
  - test: add regression tests for --reference flag in evaluate command (`3a58405`)

- Updated dependencies
  - @webui-rubric/capture@0.1.4
  - @webui-rubric/core@0.1.4

## 0.1.3

### Patch Changes

- ### Bug Fixes
  - fix: use const for non-reassigned pixel comparison variables (`97d2774`)
  - fix: wire --reference flag into evaluate command for pixel comparison (`33fc4d4`)

  ### Chores
  - chore: add husky and lint-staged for pre-commit autofix (`a076099`)

  ### Other Changes
  - style: fix prettier formatting (`7b6f438`)
  - test: add regression tests for --reference flag in evaluate command (`3a58405`)

- Updated dependencies
  - @webui-rubric/capture@0.1.3
  - @webui-rubric/core@0.1.3

## 0.1.2

### Patch Changes

- ### Bug Fixes
  - fix: remove unused BrowserSession import (`1868584`)
  - fix: close Playwright browser after capture so CLI exits cleanly (`a2cd55f`)

- Updated dependencies
  - @webui-rubric/capture@0.1.2
  - @webui-rubric/core@0.1.2

## 0.1.1

### Patch Changes

- ### Bug Fixes
  - fix: auto-install Chromium browser on @webui-rubric/capture install (`f944323`)

- Updated dependencies
  - @webui-rubric/capture@0.1.1
  - @webui-rubric/core@0.1.1

## 0.1.0

### Minor Changes

- ### Features
  - feat: add automated NPM release workflow with changesets (`85e5a4b`)
  - feat: add unit tests, README, and JSDoc documentation (`5e156f1`)
  - feat: implement Web UI Evaluator CLI (Phases 1-7) (`adec28a`)

  ### Bug Fixes
  - fix: remove explicit pnpm version to resolve action-setup conflict (`ffc70de`)
  - fix: resolve CI and release workflow failures (`5855309`)
  - fix: resolve all CI lint, type, and format errors (`a718b53`)
  - fix: CI workflow and package manager version (`7f80011`)
  - fix: resolve CI build failures (`627ebe7`)

  ### Documentation
  - docs(tasks): generate implementation tasks for Web UI Evaluator CLI (`f0b278c`)
  - docs(spec): add auto-DPR inference from reference image dimensions (`0e7a810`)
  - docs(spec): add auto-dismiss for cookie/consent banners before capture (`0c7eef0`)
  - docs(spec): add reference-image contract for pixel comparison (`1c3b09d`)
  - docs(spec): add config-based mask selectors for pixel comparison (`9900ee1`)
  - docs(spec): add CSS injection capture stabilization for pixel comparison (`cc217f9`)
  - docs(plan): complete implementation plan for web UI evaluator CLI (`c0ed58e`)
  - docs(spec): add visual_parity flag to rubric sub-criteria (`52b1314`)
  - docs(spec): restrict runtime network egress to the target URL only (`083635a`)
  - docs(spec): pin deterministic-tool versions in the rubric (`6895191`)
  - docs(spec): add default-on redaction policy for captured artifacts (`e242519`)
  - docs(spec): clarify stdout/stderr output contract for evaluator CLI (`6000c85`)
  - docs: ratify constitution v1.0.0 (seven principles + governance) (`582b9f6`)

  ### Other Changes
  - style: fix prettier formatting in output.test.ts (`ef03032`)
  - test: add loop metadata unit tests (25 tests) (`92d21b1`)
  - Refactor evaluator CLI spec to be deterministic-only (`e2ed3e2`)
  - Amend constitution to v1.1.0: add code commentary and JSDoc principles (`9a8db91`)
  - Ratify project constitution v1.0.0 (`528718b`)
  - Add spec for Web UI Evaluator CLI feature (`ebafa2a`)
  - Initialize spec-kit with Claude Code integration (`dfb0d45`)

### Patch Changes

- Updated dependencies
  - @webui-rubric/capture@0.1.0
  - @webui-rubric/core@0.1.0
