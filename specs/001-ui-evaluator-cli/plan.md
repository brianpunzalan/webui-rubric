# Implementation Plan: Web UI Evaluator CLI

**Branch**: `claude/nice-clarke-Aw9y8` | **Date**: 2026-05-23 | **Spec**: `specs/001-ui-evaluator-cli/spec.md`

**Input**: Feature specification from `/specs/001-ui-evaluator-cli/spec.md`

## Summary

A deterministic CLI tool that evaluates a live web UI against a 10-dimension weighted rubric and emits a machine-parseable JSON artifact for consumption by an Evaluator/Generator agent loop. Built as a TypeScript Yarn workspaces monorepo with four packages (`core`, `cli`, `capture`, `checks`). Uses Playwright for headless browser capture, axe-core for accessibility scanning, Lighthouse (local-only via chrome-launcher) for performance lab metrics, and pixelmatch for pixel-level visual comparison. All scoring is deterministic — no LLM calls, no third-party scoring APIs at runtime.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 20 LTS

**Primary Dependencies**:

- CLI framework: `commander` (commander.js)
- Headless browser: `playwright` (Chromium only — capture, DOM, HAR, axe injection)
- Accessibility: `@axe-core/playwright` + `axe-core`
- Performance lab: `lighthouse` + `chrome-launcher` (local Chromium, no remote API)
- Pixel comparison: `pixelmatch` + `pngjs`
- Schema validation: `zod` (config + output schema validation)
- Config parsing: `yaml` (YAML project config files)
- Logging: custom leveled logger (debug/info/warn/error → stderr)

**Build/Dev Tooling**:

- Build: `vite` (library mode per package)
- Test: `vitest`
- Lint: `eslint` (flat config)
- Format: `prettier`
- Monorepo: pnpm workspaces
- Versioning: `@changesets/cli` for semantic versioning + release workflow

**Storage**: Filesystem only (debug artifacts, config files, reference images, HAR)

**Testing**: `vitest` — unit, integration, and contract tests

**Target Platform**: Node.js CLI — Linux, macOS, Windows

**Project Type**: CLI tool — Yarn workspaces monorepo (4 packages)

**Performance Goals**: ≤ 90 seconds end-to-end per evaluation (SC-001)

**Constraints**:

- Local-only runtime egress — only the target URL + its transitively-loaded resources (FR-026b)
- Deterministic scoring with rubric-pinned tool versions (FR-003, FR-026a)
- Default-on redaction of sensitive data in HAR/DOM/evidence (FR-039)
- All logs and diagnostics to stderr — stdout reserved for JSON artifact (FR-002)

**Scale/Scope**: Single-page, single-invocation evaluation

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I — Documentation Per Feature**: **PASS**
  - `specs/001-ui-evaluator-cli/quickstart.md` — user-facing guide (produced in Phase 1)
  - Worked examples for both P1 user stories: (1) single-pass evaluation of a live URL, (2) generator-consumable prioritized output with blocking list
  - Limitations section covering v1 out-of-scope items (auth, multi-page, local files)

- **Principle II — API Documentation Per Module**: **PASS**
  - `docs/api/core.md` — rubric engine, scoring, check registry, config validation, redaction, loop metadata, output schema
  - `docs/api/cli.md` — CLI commands, flags, output routing, config loading
  - `docs/api/capture.md` — browser capture pipeline: screenshots, DOM, HAR, styles, console
  - `docs/api/checks.md` — deterministic check adapters: axe, lighthouse, pixelmatch, structural
  - Every public symbol in all packages will carry JSDoc (per Principle V)

- **Principle III — README as Project Reference Hub**: **PASS**
  - `README.md` will be created (currently absent — documented non-compliant state in constitution v1.1.0)
  - Links to: specs/, docs/api/, quickstart, examples, constitution
  - Updated in the same PR that lands the feature

- **Principle IV — Code Commentary for Intent**: **PASS**
  - Modules flagged for mandatory intent comments:
    - `packages/core/src/rubric/` — weight floors (Accessibility ≥ 10), default weights, anchor thresholds per sub-criterion (WCAG, Nielsen sources)
    - `packages/core/src/scoring/` — composite re-weighting when sub-criteria are excluded, dimension score = mean × 25, priority_score formula
    - `packages/core/src/redaction/` — redaction header patterns, why POST/PUT/PATCH bodies are redacted
    - `packages/checks/src/accessibility/` — axe severity → Nielsen severity mapping
    - `packages/checks/src/pixelmatch/` — diff_ratio → 0–4 anchor thresholds
    - `packages/checks/src/performance/` — Lighthouse metric → score anchor mappings, "predicted" marker

- **Principle V — JSDoc as Standard API Documentation Format**: **PASS**
  - All 4 packages: every exported function, class, type, interface, and constant will carry `/** … */` JSDoc with `@param`, `@returns`, `@throws`, `@example`
  - Module-level `@module` blocks linking to `docs/api/<module>.md`
  - TypeScript types used for parameter/return types; JSDoc prose for descriptions

## Project Structure

### Documentation (this feature)

```text
specs/001-ui-evaluator-cli/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── evaluator-output-schema.json   # JSON Schema for the evaluation artifact
│   └── cli-commands.md                # CLI command and flag reference
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
webui-rubric/
├── .changeset/                    # Changesets config + version entries
├── .github/
│   └── workflows/
│       ├── ci.yml                 # PR gate: build, test, lint, format
│       └── release.yml            # Changesets release: tag + npm publish
├── packages/
│   ├── core/                      # Core evaluation engine
│   │   ├── src/
│   │   │   ├── types/             # Shared TypeScript types and interfaces
│   │   │   ├── rubric/            # Rubric definition, schema, default weights, version pinning
│   │   │   ├── scoring/           # Scoring engine: dimension scores, composite, re-weighting
│   │   │   ├── registry/          # Deterministic check registry (abstract interface + registration)
│   │   │   ├── config/            # Config validation, merging, weight-floor enforcement
│   │   │   ├── redaction/         # FR-039 redaction engine (HAR, DOM, evidence sanitization)
│   │   │   ├── loop/              # Loop metadata: iteration, delta, attempted-fixes dedup
│   │   │   ├── output/            # Output schema construction, zod validation, ship-ready flag
│   │   │   └── logger.ts          # Leveled logger (debug/info/warn/error → stderr)
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── cli/                       # Commander.js CLI entry point
│   │   ├── src/
│   │   │   ├── commands/          # Commander command definitions (evaluate, version)
│   │   │   ├── config/            # YAML config file loader + resolver
│   │   │   ├── output/            # Output routing: stdout/stderr/file per FR-002
│   │   │   └── index.ts           # CLI entry point + bin
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── capture/                   # Headless browser capture pipeline
│   │   ├── src/
│   │   │   ├── browser.ts         # Playwright browser lifecycle management
│   │   │   ├── screenshot.ts      # Screenshot capture at configured viewports
│   │   │   ├── dom.ts             # DOM snapshot extraction (page.content())
│   │   │   ├── har.ts             # HAR recording via Playwright recordHar
│   │   │   ├── styles.ts          # Computed styles extraction via page.evaluate
│   │   │   ├── console.ts         # Console error/warning capture
│   │   │   ├── settle.ts          # Page settle detection (networkidle + configurable delay)
│   │   │   ├── auth-detect.ts     # Authentication wall detection (FR-008)
│   │   │   └── index.ts           # Capture pipeline orchestrator
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── checks/                    # Deterministic check implementations
│       ├── src/
│       │   ├── accessibility/     # axe-core adapter: rule results → score + severity + evidence
│       │   ├── performance/       # Lighthouse adapter: CWV lab metrics → score + evidence
│       │   ├── pixelmatch/        # Pixel comparison: diff_ratio → score, diff PNG persistence
│       │   ├── structural/        # DOM/CSS structural checks (heading order, color count, focus-visible, etc.)
│       │   └── index.ts           # Check family registry + adapter exports
│       ├── tests/
│       │   ├── unit/
│       │   └── integration/
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── docs/
│   └── api/
│       ├── core.md
│       ├── cli.md
│       ├── capture.md
│       └── checks.md
├── specs/                         # Feature specs (existing)
├── package.json                   # Root: pnpm workspaces config
├── tsconfig.base.json             # Shared TypeScript config (extended by each package)
├── eslint.config.mjs              # ESLint flat config
├── .prettierrc                    # Prettier config
├── vitest.workspace.ts            # Vitest workspace config (runs all packages)
├── README.md                      # Project reference hub (Principle III)
└── CLAUDE.md                      # Agent context
```

**Structure Decision**: Yarn workspaces monorepo with 4 packages. `core` holds the rubric engine, scoring math, check registry abstraction, config validation, redaction, loop metadata, and output schema — it is the dependency-free center of the system. `cli` is the thin commander.js shell that orchestrates `core`, `capture`, and `checks`. `capture` isolates all Playwright browser interaction. `checks` contains the concrete adapters for axe-core, Lighthouse, pixelmatch, and structural DOM/CSS checks. Each package builds independently with Vite in library mode and is testable in isolation with Vitest.

## Complexity Tracking

No constitution violations. All five principles are satisfiable within the planned scope.
