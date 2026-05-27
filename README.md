# webui-rubric

Deterministic CLI tool that evaluates a live web UI against a 10-dimension weighted rubric and emits a machine-parseable JSON evaluation artifact. Designed for consumption by an Evaluator/Generator agent loop — no LLM calls, all scoring from automated checks.

![CI](https://img.shields.io/badge/CI-passing-brightgreen)
![npm](https://img.shields.io/npm/v/@webui-rubric/cli)
![Node](https://img.shields.io/node/v/@webui-rubric/cli)

## Installation

**Prerequisites**

- Node.js >= 20 LTS
- Playwright Chromium browser
- Chrome/Chromium for Lighthouse (via `chrome-launcher` or system install)

```bash
# Install globally
yarn global add @webui-rubric/cli

# Install Playwright's Chromium browser
npx playwright install chromium

# Or run without installing
npx @webui-rubric/cli evaluate https://example.com
```

## Quick Start

```bash
webui-rubric evaluate https://example.com
```

JSON artifact on stdout, one-line summary on stderr:

```
score=82 blocking=0 issues=5 ship_ready=true
```

Save the artifact to a file (summary moves to stdout):

```bash
webui-rubric evaluate https://example.com --out result.json
```

See the [Quickstart Guide](specs/001-ui-evaluator-cli/quickstart.md) for pixel comparison, iteration loop, and custom configuration examples.

## CLI Reference

Full documentation: [docs/api/cli.md](docs/api/cli.md) | [CLI Command Reference](specs/001-ui-evaluator-cli/contracts/cli-commands.md)

| Command           | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `evaluate <url>`  | Evaluate a live URL and emit the JSON evaluation artifact    |
| `version`         | Print CLI, rubric, and pinned tool versions                  |
| `validate-config` | Validate a project configuration file without running a scan |
| `check-tools`     | Verify installed tool versions match the rubric's pin set    |

### `evaluate` key options

| Option                       | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `--config <path>`            | Project config file (default: `.webui-rubric.yml`)        |
| `--out <path>`               | Write JSON artifact to file; summary goes to stdout       |
| `--reference <path>`         | Reference PNG for pixel comparison                        |
| `--reference-viewport <name>`| Viewport the reference image represents (default: desktop)|
| `--viewports <list>`         | Comma-separated viewports to capture (default: desktop,mobile) |
| `--debug-dir <path>`         | Persist screenshots, HAR, DOM snapshot, and diff PNGs     |
| `--iteration <n>`            | Loop iteration index for convergence tracking             |
| `--previous-composite <n>`   | Previous composite score for delta calculation            |
| `--attempted-fixes <path>`   | JSON file of attempted fix hashes for deduplication       |
| `--allow-tool-version-drift` | Proceed when installed tool versions differ from rubric pins |
| `--no-redact`                | Disable default redaction of sensitive data in HAR/DOM    |
| `--log-level <level>`        | Log verbosity: debug, info, warn, error (default: info)   |
| `-q, --quiet`                | Suppress all logs below error                             |

## Architecture Overview

Yarn workspaces monorepo with four packages:

| Package                 | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `@webui-rubric/core`    | Rubric engine, scoring math, config validation, types, redaction, loop metadata |
| `@webui-rubric/cli`     | Commander.js entry point, config loading, output routing to stdout/file         |
| `@webui-rubric/capture` | Playwright headless capture pipeline: screenshots, DOM, HAR, computed styles    |
| `@webui-rubric/checks`  | Deterministic check adapters: axe-core, Lighthouse, pixelmatch, structural DOM/CSS |

The CLI does not invoke any LLM. It captures browser artifacts via Playwright, runs checks locally, scores each sub-criterion deterministically, and emits a single JSON document. The artifact is intended for a downstream Evaluator agent that feeds it to a Generator agent to close the improvement loop.

## Configuration

Create `.webui-rubric.yml` in your project root to override weights, thresholds, and capture settings:

```yaml
weights:
  visual_design: 5
  layout: 10
  usability: 10
  accessibility: 25   # floor: 10; lower values require weight_overrides_ack
  content_ia: 10
  performance: 12
  code_quality: 8
  brand: 5
  consistency: 10
  microinteractions: 5

ship_threshold: 80          # composite score required for ship_ready: true
settle_timeout_ms: 3000     # ms to wait after navigation before capture
```

Then pass it explicitly or let the CLI auto-discover it:

```bash
webui-rubric evaluate https://example.com --config .webui-rubric.yml
```

See the [Quickstart Guide](specs/001-ui-evaluator-cli/quickstart.md) for the full configuration reference and pixel-comparison mask selectors.

## Links

| Resource                  | Path                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- |
| Feature Specification     | [specs/001-ui-evaluator-cli/spec.md](specs/001-ui-evaluator-cli/spec.md)         |
| Quickstart Guide          | [specs/001-ui-evaluator-cli/quickstart.md](specs/001-ui-evaluator-cli/quickstart.md) |
| Implementation Plan       | [specs/001-ui-evaluator-cli/plan.md](specs/001-ui-evaluator-cli/plan.md)         |
| CLI Command Reference     | [specs/001-ui-evaluator-cli/contracts/cli-commands.md](specs/001-ui-evaluator-cli/contracts/cli-commands.md) |
| Output Schema             | [specs/001-ui-evaluator-cli/contracts/evaluator-output-schema.json](specs/001-ui-evaluator-cli/contracts/evaluator-output-schema.json) |
| Data Model                | [specs/001-ui-evaluator-cli/data-model.md](specs/001-ui-evaluator-cli/data-model.md) |
| API Docs: core            | [docs/api/core.md](docs/api/core.md)                                             |
| API Docs: cli             | [docs/api/cli.md](docs/api/cli.md)                                               |
| API Docs: capture         | [docs/api/capture.md](docs/api/capture.md)                                       |
| API Docs: checks          | [docs/api/checks.md](docs/api/checks.md)                                         |
| Project Constitution      | [.specify/memory/constitution.md](.specify/memory/constitution.md)               |

## Development

```bash
# Install all workspace dependencies
yarn install

# Build all packages
yarn build

# Run tests across all packages
yarn test

# Lint
yarn lint

# Format (check)
yarn format:check

# Format (fix)
yarn format
```

### Contributing

1. Create a feature branch (`git checkout -b feat/my-change`).
2. Make changes and add tests — `yarn test` must pass.
3. Add a changeset: `yarn changeset`.
4. Open a pull request.

## License

MIT
