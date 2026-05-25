# @webui-rubric/core

## 0.1.2

### Patch Changes

- ### Bug Fixes
  - fix: remove unused BrowserSession import (`1868584`)
  - fix: close Playwright browser after capture so CLI exits cleanly (`a2cd55f`)

## 0.1.1

### Patch Changes

- ### Bug Fixes
  - fix: auto-install Chromium browser on @webui-rubric/capture install (`f944323`)

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
