# CLI API Reference

`@webui-rubric/cli` — command-line interface commands, flags, output routing,
and config loading.

**Source:** `packages/cli/src/`

---

## Commands

### `evaluate <url>`

Evaluate a live web UI against the rubric and emit a JSON artifact.

| Flag | Default | Description |
|---|---|---|
| `--config <path>` | `.webui-rubric.yml` | Project configuration file. |
| `--out <path>` | *(stdout)* | Write JSON artifact to a file instead of stdout. |
| `--reference <path>` | — | Reference design image (PNG) for pixel comparison. |
| `--reference-viewport <name>` | `desktop` | Which viewport the reference image represents. |
| `--viewports <list>` | `desktop,mobile` | Comma-separated viewport names to capture. |
| `--debug-dir <path>` | — | Directory for debug artifacts (screenshots, DOM snapshots). |
| `--iteration <n>` | — | Loop iteration index (integer). |
| `--previous-composite <n>` | — | Previous composite score for delta calculation. |
| `--attempted-fixes <path>` | — | Path to JSON file of previously attempted fix hashes. |
| `--allow-overrun` | `false` | Allow iterations beyond the configured cap. |
| `--allow-tool-version-drift` | `false` | Proceed even when tool versions differ from rubric pins. |
| `--no-redact` | *(redaction on)* | Disable redaction of sensitive HAR/DOM data. |
| `--log-level <level>` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`). |
| `-q, --quiet` | `false` | Suppress all logs below `error`. |

**Output routing:** if `--out` is given the artifact is written to that path;
otherwise it is streamed to stdout. Log output always goes to stderr.

**Exit codes:** `0` = success, `1` = evaluation error, `2` = config/arg error,
`3` = tool version mismatch.

---

### `version`

Print CLI version, rubric version, and pinned tool versions.

| Flag | Description |
|---|---|
| `--json` | Output as machine-readable JSON. |

**Source:** `packages/cli/src/commands/version.ts`

---

### `check-tools`

Verify that installed tool versions match the rubric's pinned versions. Exits
with code `3` when any version mismatches.

| Flag | Description |
|---|---|
| `--json` | Output results as JSON. |

Checks: `axe-core`, `lighthouse`, `pixelmatch`, `playwright`.

**Source:** `packages/cli/src/commands/check-tools.ts`

---

### `validate-config`

Validate a project configuration file without running an evaluation. Emits
errors to stderr and exits with code `2` on failure.

| Flag | Default | Description |
|---|---|---|
| `--config <path>` | `.webui-rubric.yml` | Path to config file. |

**Source:** `packages/cli/src/commands/validate-config.ts`

---

## Config loading (`config/index.ts`)

| Export | Description |
|---|---|
| `loadConfigFile(path)` | Read and parse a YAML or JSON config file; returns raw object. |
| `resolveConfigPath(input)` | Resolve a config path relative to `process.cwd()`. |

---

## Usage example

```sh
# Evaluate a URL, writing artifact to a file
webui-rubric evaluate https://example.com \
  --config my-project.yml \
  --out result.json \
  --reference designs/desktop.png \
  --viewports desktop,mobile

# Check tool versions
webui-rubric check-tools --json

# Validate config only
webui-rubric validate-config --config my-project.yml

# Print version info
webui-rubric version --json
```

**Source:** `packages/cli/src/commands/`
