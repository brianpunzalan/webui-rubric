# webui-rubric

Deterministic CLI tool that evaluates a live web UI against a 10-dimension weighted rubric and emits a machine-parseable JSON evaluation artifact. Designed for consumption by an Evaluator/Generator agent loop -- no LLM calls, all scoring from automated checks.

## Quick Start

```bash
# Install globally
npm install -g @webui-rubric/cli

# Or run directly
npx @webui-rubric/cli evaluate https://example.com

# Save output to a file
webui-rubric evaluate https://example.com --out result.json

# With debug artifacts (screenshots, HAR, diffs)
webui-rubric evaluate https://example.com --debug-dir ./debug-output

# Pixel comparison against a reference design
webui-rubric evaluate https://example.com --reference ./design/homepage.png

# Generate a self-contained evaluation-results bundle (images + manifest + HTML report)
webui-rubric evaluate https://example.com --reference ./design/homepage.png --artifact-dir ./eval-results
```

### Prerequisites

- Node.js >= 20 LTS
- Playwright Chromium (`npx playwright install chromium`)
- Chrome/Chromium for Lighthouse (via `chrome-launcher` or system install)

## Features

- 10-dimension rubric: Visual Design, Layout, Usability, Accessibility, Content/IA, Performance, Code Quality, Brand, Consistency, Microinteractions
- Deterministic scoring from axe-core, Lighthouse, pixelmatch, and structural DOM/CSS checks
- Generator-consumable output with blocking list, top issues, and ship-ready indicator
- Per-project configuration via YAML (custom weights, thresholds, viewports)
- Pixel-level comparison against reference design images
- Curated evaluation-results artifact bundle (`--artifact-dir`): reference/screenshot/diff/composite images, per-region crops, a `manifest.json`, and an offline HTML report for Evaluator/Generator agents
- Iterative loop metadata for convergence tracking (delta, attempted-fix deduplication, iteration cap)

## Architecture

pnpm workspaces monorepo with 4 packages:

| Package                 | Description                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `@webui-rubric/core`    | Rubric engine, scoring math, types, config validation, redaction, loop metadata    |
| `@webui-rubric/cli`     | Commander.js CLI entry point, config loading, output routing                       |
| `@webui-rubric/capture` | Playwright headless browser capture pipeline (screenshots, DOM, HAR, styles)       |
| `@webui-rubric/checks`  | Deterministic check adapters: axe-core, Lighthouse, pixelmatch, structural DOM/CSS |

## CLI Commands

### `evaluate` (default)

```bash
webui-rubric evaluate <url> [options]
```

Key options: `--config`, `--out`, `--reference`, `--viewports`, `--debug-dir`, `--artifact-dir`, `--iteration`, `--previous-composite`, `--attempted-fixes`.

### `version`

Print CLI, rubric, and pinned tool versions.

### `validate-config`

Validate a project configuration file without running an evaluation.

### `check-tools`

Verify installed tool versions match the rubric's pinned versions.

See the full [CLI Command Reference](specs/001-ui-evaluator-cli/contracts/cli-commands.md) for all flags, exit codes, and output contracts.

## Configuration

Create `.webui-rubric.yml` in your project root:

```yaml
weights:
  visual_design: 10
  layout: 10
  usability: 12
  accessibility: 15
  content_ia: 8
  performance: 12
  code_quality: 8
  brand: 5
  consistency: 10
  microinteractions: 10

ship_threshold: 75
settle_timeout_ms: 30000
```

Weights must sum to 100. Accessibility has a weight floor of 10 (overridable via `weight_overrides_ack`). See the [Quickstart Guide](specs/001-ui-evaluator-cli/quickstart.md) for more configuration examples.

## Documentation

- [Feature Specification](specs/001-ui-evaluator-cli/spec.md)
- [Implementation Plan](specs/001-ui-evaluator-cli/plan.md)
- [CLI Command Reference](specs/001-ui-evaluator-cli/contracts/cli-commands.md)
- [Output Schema](specs/001-ui-evaluator-cli/contracts/evaluator-output-schema.json)
- [Data Model](specs/001-ui-evaluator-cli/data-model.md)
- [Quickstart Guide](specs/001-ui-evaluator-cli/quickstart.md)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Format (check)
pnpm format:check

# Format (fix)
pnpm format
```

## License

MIT
