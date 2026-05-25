# CLI Command Reference

**Package**: `@webui-rubric/cli` | **Date**: 2026-05-23

## Binary

```
webui-rubric <command> [options]
```

Installed globally via npm/yarn or invoked via `npx @webui-rubric/cli`.

## Commands

### `evaluate` (default)

Evaluate a live web UI against the rubric.

```
webui-rubric evaluate <url> [options]
```

#### Positional Arguments

| Argument | Required | Description                                                            |
| -------- | -------- | ---------------------------------------------------------------------- |
| `url`    | Yes      | Fully qualified URL of the target web UI (e.g., `https://example.com`) |

#### Options

| Flag                          | Type      | Default             | Description                                                                      |
| ----------------------------- | --------- | ------------------- | -------------------------------------------------------------------------------- |
| `--config <path>`             | `string`  | `.webui-rubric.yml` | Path to the project configuration file                                           |
| `--out <path>`                | `string`  | (stdout)            | Write JSON artifact to file instead of stdout; summary moves to stdout           |
| `--reference <path>`          | `string`  | (none)              | Reference design image (PNG) for pixel comparison                                |
| `--reference-viewport <name>` | `string`  | `"desktop"`         | Which viewport the reference image represents                                    |
| `--viewports <list>`          | `string`  | `"desktop,mobile"`  | Comma-separated viewport names to capture                                        |
| `--debug-dir <path>`          | `string`  | (none)              | Directory for debug artifacts (screenshots, HAR, diffs). Created with mode 0700. |
| `--iteration <n>`             | `number`  | (none)              | Loop iteration index for Evaluator/Generator convergence tracking                |
| `--previous-composite <n>`    | `number`  | (none)              | Previous run's composite score (used to compute delta)                           |
| `--attempted-fixes <path>`    | `string`  | (none)              | Path to JSON file listing previously attempted fix hashes                        |
| `--allow-overrun`             | `boolean` | `false`             | Allow iterations beyond the configured cap                                       |
| `--allow-tool-version-drift`  | `boolean` | `false`             | Proceed when installed tool versions differ from rubric pins                     |
| `--no-redact`                 | `boolean` | `false`             | Disable default redaction of sensitive data in HAR/DOM/evidence                  |
| `--log-level <level>`         | `string`  | `"info"`            | Log verbosity: `debug`, `info`, `warn`, `error`                                  |
| `--quiet`, `-q`               | `boolean` | `false`             | Suppress all log output below `error`                                            |
| `--help`, `-h`                | `boolean` |                     | Show help                                                                        |

#### Output Contract (FR-002)

| Mode                 | stdout                   | stderr                  |
| -------------------- | ------------------------ | ----------------------- |
| Default (no `--out`) | JSON evaluation artifact | One-line summary + logs |
| With `--out <file>`  | One-line summary         | Logs only               |

The one-line summary format:

```
score=82 blocking=0 issues=5 ship_ready=true
```

#### Exit Codes

| Code | Meaning                                                                   |
| ---- | ------------------------------------------------------------------------- |
| `0`  | Evaluation completed successfully                                         |
| `1`  | Runtime error (target unreachable, tool crash, schema validation failure) |
| `2`  | Configuration error (invalid config, weight sum ≠ 100, missing anchors)   |
| `3`  | Tool version mismatch (without `--allow-tool-version-drift`)              |
| `4`  | Iteration cap exceeded (without `--allow-overrun`)                        |
| `5`  | Precondition failure (auth wall detected, target returned server error)   |

### `version`

Print CLI version, rubric version, and pinned tool versions.

```
webui-rubric version [--json]
```

| Flag     | Description                                                |
| -------- | ---------------------------------------------------------- |
| `--json` | Output version info as JSON instead of human-readable text |

### `validate-config`

Validate a project configuration file without running an evaluation.

```
webui-rubric validate-config [--config <path>]
```

| Flag              | Default             | Description                         |
| ----------------- | ------------------- | ----------------------------------- |
| `--config <path>` | `.webui-rubric.yml` | Path to the config file to validate |

Exits 0 if valid, 2 if invalid (with error details on stderr).

### `check-tools`

Verify that all pinned tool versions are installed and match the rubric.

```
webui-rubric check-tools [--json]
```

Reports installed vs. pinned versions for each tool. Exits 0 if all match, 3 if any mismatch.

## Configuration File Schema

File: `.webui-rubric.yml` (or `--config <path>`)

```yaml
# Rubric version this config is written against (optional)
rubric_version: '1.0.0'

# Dimension weight overrides (must sum to 100)
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

# Required when overriding a dimension below its weight floor
weight_overrides_ack:
  - accessibility # Acknowledges override of the weight floor for accessibility

# Toggle blocking_if_zero per sub-criterion
blocking_overrides:
  accessibility.color-contrast: true # already default true
  usability.focus-visible: true # promote to blocking

# Custom sub-criteria added to existing dimensions
custom_sub_criteria:
  - dimension: usability
    id: usability.custom-tab-order
    name: 'Custom Tab Order Check'
    bound_check:
      check_family: playwright
      check_id: custom-tab-order
    anchors:
      - score: 0
        label: 'Critical'
        description: 'Tab order is completely broken'
      - score: 1
        label: 'Poor'
        description: 'Multiple tab-order violations'
      - score: 2
        label: 'Needs improvement'
        description: 'Some tab-order issues'
      - score: 3
        label: 'Good'
        description: 'Minor tab-order issues only'
      - score: 4
        label: 'Excellent'
        description: 'Tab order follows logical reading order'

# Viewport configuration
viewports:
  desktop:
    width: 1280
    height: 800
  mobile:
    width: 375
    height: 812

# Reference images for pixel comparison
reference_images:
  desktop: './reference/desktop.png'
  mobile: './reference/mobile.png'

# Behavior flags
reference_image_mismatch_policy: 'fail-fast' # or "resize"
pixelmatch_threshold: 0.1
tool_fallback_policy: 'fail-fast' # or "mark-unavailable"
iteration_cap: 5
ship_threshold: 75
top_issues_cap: 10
settle_timeout_ms: 5000
redaction: true
```
