import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ArtifactViewportInput } from '../artifact/index.js';

export const evaluateCommand = new Command('evaluate')
  .description('Evaluate a live web UI against the rubric')
  .argument('<url>', 'Fully qualified URL of the target web UI')
  .option('--config <path>', 'Path to project configuration file', '.webui-rubric.yml')
  .option('--out <path>', 'Write JSON artifact to file instead of stdout')
  .option('--reference <path>', 'Reference design image (PNG) for pixel comparison')
  .option('--reference-viewport <name>', 'Which viewport the reference image represents', 'desktop')
  .option('--viewports <list>', 'Comma-separated viewport names to capture', 'desktop,mobile')
  .option('--browser <engine>', 'Playwright capture engine: chromium | firefox | webkit')
  .option('--debug-dir <path>', 'Directory for debug artifacts')
  .option('--artifact-dir <path>', 'Directory for the evaluation-results artifact bundle')
  .option('--iteration <n>', 'Loop iteration index', parseInt)
  .option('--previous-composite <n>', 'Previous composite score', parseFloat)
  .option('--attempted-fixes <path>', 'Path to JSON file of attempted fix hashes')
  .option('--allow-overrun', 'Allow iterations beyond cap', false)
  .option('--allow-tool-version-drift', 'Proceed with version mismatches', false)
  .option('--no-redact', 'Disable redaction of sensitive data')
  .option('--log-level <level>', 'Log verbosity', 'info')
  .option('-q, --quiet', 'Suppress logs below error', false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .action(async (url: string, options: Record<string, any>) => {
    const startTime = Date.now();

    try {
      // Dynamic imports to avoid circular dependencies
      const { setLogLevel, setQuiet, logger } = await import('@webui-rubric/core');
      const { V1_RUBRIC } = await import('@webui-rubric/core');
      const { validateOutput } = await import('@webui-rubric/core');
      const { computeCompositeScore, buildDimensionResult } = await import('@webui-rubric/core');
      const { redactHarHeaders, redactDomSnapshot, isRedactionEnabled } =
        await import('@webui-rubric/core');
      const { validateProjectConfig, validateWeights } = await import('@webui-rubric/core');

      // Configure logger
      if (options.quiet) setQuiet(true);
      if (options.logLevel) setLogLevel(options.logLevel);

      logger.info(`Evaluating ${url}`);

      // Load config
      const { loadConfigFile, resolveConfigPath } = await import('../config/index.js');
      const configPath = resolveConfigPath(options.config);
      const rawConfig = await loadConfigFile(configPath);
      const configResult = validateProjectConfig(rawConfig);
      if (!configResult.valid) {
        logger.error(`Configuration error: ${configResult.errors.join('; ')}`);
        process.exit(2);
      }
      const config = configResult.config!;

      // Resolve effective weights
      const effectiveWeights: Record<string, number> = {};
      for (const dim of V1_RUBRIC.dimensions) {
        effectiveWeights[dim.id] = config.weights?.[dim.id] ?? dim.default_weight;
      }

      // Validate weights if custom
      if (config.weights) {
        const weightErrors = validateWeights(
          config.weights,
          V1_RUBRIC,
          config.weight_overrides_ack,
        );
        if (weightErrors.length > 0) {
          logger.error(`Weight validation: ${weightErrors.join('; ')}`);
          process.exit(2);
        }
      }

      // Check iteration cap
      if (options.iteration !== undefined) {
        const cap = config.iteration_cap ?? 5;
        if (options.iteration > cap && !options.allowOverrun) {
          logger.error(
            `Iteration ${options.iteration} exceeds cap of ${cap}. Use --allow-overrun to proceed.`,
          );
          process.exit(4);
        }
      }

      // Resolve capture engine: CLI flag > config > default. Lighthouse is
      // unaffected (it runs its own Chromium), so non-Chromium engines only
      // change Playwright capture.
      const SUPPORTED_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
      const browser = options.browser ?? config.capture?.browser ?? 'chromium';
      if (!SUPPORTED_BROWSERS.includes(browser)) {
        logger.error(
          `Unknown browser engine "${browser}". Supported: ${SUPPORTED_BROWSERS.join(', ')}`,
        );
        process.exit(2);
      }

      // Capture phase
      logger.info(`Starting capture phase (browser: ${browser})...`);
      const { capturePage } = await import('@webui-rubric/capture');

      // Build viewport specs from config, filtered by --viewports CLI option
      const configViewports = config.viewports ?? {
        desktop: { width: 1280, height: 800 },
        mobile: { width: 375, height: 812 },
      };
      const requestedNames = (options.viewports as string).split(',').map((s: string) => s.trim());
      const viewportSpecs: Array<{
        name: string;
        width: number;
        height: number;
        fullPage?: boolean;
      }> = [];
      for (const name of requestedNames) {
        const dims =
          (configViewports as Record<string, { width: number; height: number }>)[name] ??
          configViewports.custom?.[name];
        if (dims) {
          viewportSpecs.push({ name, width: dims.width, height: dims.height, fullPage: false });
        } else {
          logger.warn(`Unknown viewport "${name}" — skipping`);
        }
      }

      // Resolve device pixel ratio
      let deviceScaleFactor = 1;
      const dprConfig = config.pixel_comparison?.device_pixel_ratio;
      if (typeof dprConfig === 'number') {
        deviceScaleFactor = dprConfig;
        logger.info(`Using configured device_pixel_ratio: ${deviceScaleFactor}`);
      } else if (options.reference) {
        const { loadReferenceImage, inferDpr } = await import('@webui-rubric/capture');
        const refInfo = loadReferenceImage(resolve(options.reference));
        const referenceViewport = options.referenceViewport ?? 'desktop';
        const vpDims =
          (configViewports as Record<string, { width: number; height: number }>)[
            referenceViewport
          ] ?? configViewports.custom?.[referenceViewport];
        if (vpDims) {
          deviceScaleFactor = inferDpr(refInfo.width, refInfo.height, vpDims.width, vpDims.height);
          if (deviceScaleFactor > 1) {
            logger.info(
              `Inferred device_pixel_ratio: ${deviceScaleFactor} (from reference image ${refInfo.width}x${refInfo.height} vs viewport ${vpDims.width}x${vpDims.height})`,
            );
          } else {
            logger.info(`Using default device_pixel_ratio: ${deviceScaleFactor}`);
          }
        } else {
          logger.info(`Using default device_pixel_ratio: ${deviceScaleFactor}`);
        }
      } else {
        logger.info(`Using default device_pixel_ratio: ${deviceScaleFactor}`);
      }

      const captureResult = await capturePage(url, {
        settleTimeoutMs: config.settle_timeout_ms ?? 30000,
        additionalSettleDelay: 5000,
        deviceScaleFactor,
        autoDismiss: config.capture?.auto_dismiss ?? true,
        dismissSelectors: config.capture?.dismiss_selectors,
        viewports: viewportSpecs.length > 0 ? viewportSpecs : undefined,
        browser,
      });

      logger.info('Capture complete. Running checks...');

      // Apply redaction — CLI --no-redact overrides config
      const redactionEnabled = options.redact !== false && isRedactionEnabled(config);
      if (redactionEnabled && captureResult.har) {
        redactHarHeaders(captureResult.har);
      }
      let domSnapshot = captureResult.dom_snapshot;
      if (redactionEnabled) {
        domSnapshot = redactDomSnapshot(domSnapshot);
      }

      // Run checks
      const {
        checkHeadingOrder,
        checkLandmarkUsage,
        checkLinkDescriptiveness,
        checkImageAlt,
        checkFormLabels,
        checkMetaViewport,
      } = await import('@webui-rubric/checks');
      const { checkUniqueColorCount, checkFontFamilyCount, checkSpacingConsistency } =
        await import('@webui-rubric/checks');
      const { checkConsoleErrors, checkResourceCount } = await import('@webui-rubric/checks');

      // Run structural checks on captured artifacts
      const domChecks = {
        'dom.heading-order': checkHeadingOrder(domSnapshot),
        'dom.landmark-usage': checkLandmarkUsage(domSnapshot),
        'dom.link-descriptiveness': checkLinkDescriptiveness(domSnapshot),
        'dom.image-alt': checkImageAlt(domSnapshot),
        'dom.form-labels': checkFormLabels(domSnapshot),
        'dom.meta-viewport': checkMetaViewport(domSnapshot),
      };

      const cssChecks = {
        'css.unique-color-count': checkUniqueColorCount(captureResult.computed_styles),
        'css.font-family-count': checkFontFamilyCount(captureResult.computed_styles),
        'css.spacing-consistency': checkSpacingConsistency(captureResult.computed_styles),
      };

      const runtimeChecks = {
        'console.error-count': checkConsoleErrors(captureResult.console_errors),
        'har.resource-count': checkResourceCount(captureResult.har),
      };

      // Run Lighthouse for performance metrics
      let lighthouseResults: Array<{
        evidence_source: string;
        score: number | null;
        status: string;
        evidence: string;
        severity: number;
        suggested_fix: string[];
      }> = [];
      try {
        const { runLighthouseChecks } = await import('@webui-rubric/checks');
        lighthouseResults = await runLighthouseChecks(url);
        // runLighthouseChecks degrades gracefully (returns tool_unavailable
        // findings) instead of throwing when Chromium can't run. Surface that
        // so the user knows the performance dimension is degraded.
        const unavailable = lighthouseResults.filter((r) => r.status === 'tool_unavailable');
        if (unavailable.length > 0) {
          logger.warn(
            `Lighthouse unavailable (Chromium could not run): ${unavailable
              .map((r) => r.evidence_source)
              .join(', ')} excluded. The performance dimension will be scored from ` +
              `resource-efficiency only. Run "npx playwright install chromium" to enable ` +
              `performance metrics.`,
          );
        } else {
          logger.info('Lighthouse checks complete.');
        }
      } catch (error) {
        logger.warn(
          `Lighthouse failed: ${error instanceof Error ? error.message : 'unknown'}. ` +
            `Performance metrics (LCP/FCP/CLS/TBT) will be excluded; the performance ` +
            `dimension will be scored from resource-efficiency only.`,
        );
      }

      // Reference image pixel comparison
      let suggestedFixBuilder:
        | ((input: {
            mappedRegions: Array<{
              y_start: number;
              y_end: number;
              diff_pixel_count: number;
              pct_of_total_diff: number;
              elements: Array<{
                selector: string;
                tagName: string;
                styleDiffs: Array<{ property: string; actual: string; expected: string }>;
              }>;
            }>;
            diffRatio: number;
          }) => string[])
        | null = null;
      const pixelComparisonResults: Map<
        string,
        {
          score: number | null;
          diffRatio: number;
          evidence: string;
          status?: 'tool_unavailable';
          mappedRegions?: Array<{
            y_start: number;
            y_end: number;
            diff_pixel_count: number;
            pct_of_total_diff: number;
            elements: Array<{
              selector: string;
              tagName: string;
              styleDiffs: Array<{ property: string; actual: string; expected: string }>;
            }>;
          }>;
        }
      > = new Map();
      const pixelComparisonOutput: Array<{
        viewport: string;
        diff_pixel_count: number;
        total_pixel_count: number;
        diff_ratio: number;
        threshold: number;
        diff_png_path: string | null;
        reference_image_path: string;
        screenshot_dimensions: { width: number; height: number };
        reference_dimensions: { width: number; height: number };
        diff_regions?: Array<{
          y_start: number;
          y_end: number;
          diff_pixel_count: number;
          pct_of_total_diff: number;
          elements: Array<{
            selector: string;
            tagName: string;
            styleDiffs: Array<{ property: string; actual: string; expected: string }>;
          }>;
        }>;
      }> = [];
      // Image buffers + metrics retained per compared viewport for artifact assembly.
      const artifactViewportInputs: ArtifactViewportInput[] = [];

      if (options.reference) {
        const refPath = resolve(options.reference);
        if (!existsSync(refPath)) {
          logger.error(`Reference image not found: ${refPath}`);
          process.exit(2);
        }

        const { loadReferenceImage } = await import('@webui-rubric/capture');
        const {
          runPixelmatch,
          scoreFromDiffRatio,
          mapDiffRegionsToElements,
          buildVisualParitySuggestedFix: buildFix,
        } = await import('@webui-rubric/checks');
        suggestedFixBuilder = buildFix;
        const { PNG } = await import('pngjs');

        const referenceImage = loadReferenceImage(refPath);
        const referenceViewport = options.referenceViewport ?? 'desktop';
        logger.info(
          `Loaded reference image (${referenceImage.width}x${referenceImage.height}) for viewport: ${referenceViewport}`,
        );

        const screenshotBuffer = captureResult.screenshots.get(referenceViewport);
        if (!screenshotBuffer) {
          logger.error(
            `No screenshot captured for viewport "${referenceViewport}". Available: ${[...captureResult.screenshots.keys()].join(', ')}`,
          );
          process.exit(2);
        }

        // Dimension mismatch check
        const screenshotPng = PNG.sync.read(screenshotBuffer);
        if (
          referenceImage.width !== screenshotPng.width ||
          referenceImage.height !== screenshotPng.height
        ) {
          const mismatchMsg =
            `Reference image (${referenceImage.width}x${referenceImage.height}) does not match screenshot (${screenshotPng.width}x${screenshotPng.height}). ` +
            `Pixel comparison requires identical dimensions. Provide a reference at matching resolution or set an explicit device_pixel_ratio in config.`;
          logger.warn(mismatchMsg);

          // The pixel diff can't run, but the artifact bundle is still useful:
          // record the reference and screenshot images (no diff/composite) so
          // --artifact-dir produces something the agent can inspect.
          artifactViewportInputs.push({
            viewport: referenceViewport,
            referenceBuffer: referenceImage.buffer,
            screenshotBuffer,
            diffBuffer: null,
            diff_ratio: -1,
            diff_pixel_count: 0,
            total_pixel_count: 0,
            threshold: config.pixelmatch_threshold ?? 0.1,
            score: null,
            diff_regions: [],
            note: mismatchMsg,
          });

          for (const dim of V1_RUBRIC.dimensions) {
            for (const sub of dim.sub_criteria) {
              if (!sub.visual_parity) continue;
              const checkId = sub.bound_check.full_id;
              const vpMatch = checkId.match(/viewport=(\w+)/);
              const boundViewport = vpMatch ? vpMatch[1] : 'desktop';
              if (boundViewport === referenceViewport) {
                pixelComparisonResults.set(sub.id, {
                  score: null,
                  diffRatio: -1,
                  evidence: mismatchMsg.slice(0, 300),
                  status: 'tool_unavailable' as const,
                });
              }
            }
          }
        } else {
          // Ensure the debug dir exists before pixelmatch writes the diff PNG into it.
          if (options.debugDir) {
            await mkdir(resolve(options.debugDir), { recursive: true, mode: 0o700 });
          }
          const diffOutputPath = options.debugDir
            ? resolve(options.debugDir, `diff-${referenceViewport}.png`)
            : null;

          const pmResult = runPixelmatch({
            screenshotBuffer,
            referenceBuffer: referenceImage.buffer,
            threshold: config.pixelmatch_threshold ?? 0.1,
            diffOutputPath,
          });

          const vpScore = scoreFromDiffRatio(pmResult.diff_ratio);
          const pctDiff = (pmResult.diff_ratio * 100).toFixed(2);

          // Map diff regions to DOM elements
          const refRgba = new Uint8Array(
            referenceImage.png.data.buffer,
            referenceImage.png.data.byteOffset,
            referenceImage.png.data.byteLength,
          );
          const mappedRegions = mapDiffRegionsToElements(
            pmResult.diff_regions,
            captureResult.element_locations,
            refRgba,
            referenceImage.width,
          );

          pixelComparisonOutput.push({
            viewport: referenceViewport,
            diff_pixel_count: pmResult.diff_pixel_count,
            total_pixel_count: pmResult.total_pixel_count,
            diff_ratio: pmResult.diff_ratio,
            threshold: pmResult.threshold,
            diff_png_path: pmResult.diff_png_path,
            reference_image_path: refPath,
            screenshot_dimensions: pmResult.screenshot_dimensions,
            reference_dimensions: pmResult.reference_dimensions,
            diff_regions: mappedRegions,
          });

          artifactViewportInputs.push({
            viewport: referenceViewport,
            referenceBuffer: referenceImage.buffer,
            screenshotBuffer,
            diffBuffer: pmResult.diff_buffer,
            diff_ratio: pmResult.diff_ratio,
            diff_pixel_count: pmResult.diff_pixel_count,
            total_pixel_count: pmResult.total_pixel_count,
            threshold: pmResult.threshold,
            score: vpScore,
            diff_regions: mappedRegions,
          });

          // Map results to each visual parity sub-criterion by its bound viewport
          for (const dim of V1_RUBRIC.dimensions) {
            for (const sub of dim.sub_criteria) {
              if (!sub.visual_parity) continue;
              const checkId = sub.bound_check.full_id;
              const vpMatch = checkId.match(/viewport=(\w+)/);
              const boundViewport = vpMatch ? vpMatch[1] : 'desktop';
              if (boundViewport === referenceViewport) {
                pixelComparisonResults.set(sub.id, {
                  score: vpScore,
                  diffRatio: pmResult.diff_ratio,
                  evidence: `Pixel diff: ${pctDiff}% (${pmResult.diff_pixel_count}/${pmResult.total_pixel_count} pixels differ)`,
                  mappedRegions,
                });
              }
            }
          }

          logger.info(`Pixelmatch complete: ${pctDiff}% diff, score ${vpScore}/4`);
        }
      }

      // Build sub-criterion findings for each dimension
      const allCheckResults = { ...domChecks, ...cssChecks, ...runtimeChecks };

      // Map check results to dimension sub-criteria findings
      const dimensionResults = V1_RUBRIC.dimensions.map((dim) => {
        const findings = dim.sub_criteria.map((sub) => {
          const checkId = sub.bound_check.full_id;

          // Find matching check result
          const checkResult = allCheckResults[checkId as keyof typeof allCheckResults];

          // Check lighthouse results
          const lhResult = lighthouseResults.find((r) => r.evidence_source === checkId);

          if (checkResult) {
            return {
              id: sub.id,
              name: sub.name,
              score: checkResult.score as number | null,
              status: 'scored' as const,
              evidence: checkResult.evidence.slice(0, 300),
              evidence_source: checkResult.evidence_source,
              severity: checkResult.severity,
              suggested_fix: checkResult.suggested_fix ?? [],
              location: checkResult.location ?? null,
              confidence: 'deterministic' as const,
            };
          } else if (lhResult) {
            return {
              id: sub.id,
              name: sub.name,
              score: lhResult.score as number | null,
              status: lhResult.status as 'scored' | 'not_applicable' | 'tool_unavailable',
              evidence: lhResult.evidence.slice(0, 300),
              evidence_source: lhResult.evidence_source,
              severity: lhResult.severity,
              suggested_fix: lhResult.suggested_fix ?? [],
              location: null,
              confidence: 'predicted' as const,
            };
          } else if (sub.visual_parity) {
            const pmResult = pixelComparisonResults.get(sub.id);
            if (pmResult && pmResult.status === 'tool_unavailable') {
              return {
                id: sub.id,
                name: sub.name,
                score: null,
                status: 'tool_unavailable' as const,
                evidence: pmResult.evidence,
                evidence_source: checkId,
                severity: 0,
                suggested_fix: [],
                location: null,
                confidence: 'deterministic' as const,
              };
            }
            if (pmResult) {
              return {
                id: sub.id,
                name: sub.name,
                score: pmResult.score,
                status: 'scored' as const,
                evidence: pmResult.evidence,
                evidence_source: checkId,
                severity: pmResult.score !== null && pmResult.score < 4 ? 4 - pmResult.score : 0,
                suggested_fix:
                  pmResult.score !== null && pmResult.score < 4 && suggestedFixBuilder
                    ? suggestedFixBuilder({
                        mappedRegions: pmResult.mappedRegions ?? [],
                        diffRatio: pmResult.diffRatio,
                      })
                    : [],
                location: null,
                confidence: 'deterministic' as const,
              };
            }
            return {
              id: sub.id,
              name: sub.name,
              score: null,
              status: 'not_applicable' as const,
              evidence: 'No reference image supplied for visual parity comparison',
              evidence_source: checkId,
              severity: 0,
              suggested_fix: [],
              location: null,
              confidence: 'deterministic' as const,
            };
          } else {
            return {
              id: sub.id,
              name: sub.name,
              score: null,
              status: 'tool_unavailable' as const,
              evidence: `Check ${checkId} not available`,
              evidence_source: checkId,
              severity: 0,
              suggested_fix: [],
              location: null,
              confidence: 'deterministic' as const,
            };
          }
        });

        return buildDimensionResult(dim, findings, effectiveWeights[dim.id] ?? dim.default_weight);
      });

      // Compute composite score
      const compositeScore = computeCompositeScore(dimensionResults, effectiveWeights);

      // Build blocking list (US2 - T040)
      const blocking: Array<{
        criterion_id: string;
        reason: string;
        wcag_ref: string;
        evidence: string;
        location: unknown;
        severity: number;
      }> = [];
      for (const dim of V1_RUBRIC.dimensions) {
        for (const sub of dim.sub_criteria) {
          if (sub.blocking_if_zero) {
            const dimResult = dimensionResults.find((d) => d.id === dim.id);
            const finding = dimResult?.sub_criteria.find((f) => f.id === sub.id);
            if (finding && finding.score === 0 && finding.status === 'scored') {
              const wcagRef = sub.references.find((r) => r.startsWith('WCAG')) ?? '';
              blocking.push({
                criterion_id: sub.id,
                reason: `${sub.name} failed (score 0)`,
                wcag_ref: wcagRef,
                evidence: finding.evidence,
                location: finding.location ?? null,
                severity: 4,
              });
            }
          }
        }
      }

      // Build top issues list (US2 - T041)
      const allFindings: Array<{
        finding: {
          id: string;
          severity: number;
          suggested_fix: string[];
          score: number | null;
          status: string;
        };
        dimensionId: string;
        weight: number;
      }> = [];
      for (const dimResult of dimensionResults) {
        for (const finding of dimResult.sub_criteria) {
          if (finding.status === 'scored' && finding.score !== null && finding.score < 4) {
            allFindings.push({
              finding,
              dimensionId: dimResult.id,
              weight: dimResult.weight,
            });
          }
        }
      }

      const { createHash } = await import('node:crypto');

      // Load attempted fixes for oscillation prevention (US5)
      let attemptedFixHashes: Set<string> = new Set();
      if (options.attemptedFixes) {
        try {
          const { readFile } = await import('node:fs/promises');
          const fixesContent = await readFile(options.attemptedFixes, 'utf-8');
          const fixes = JSON.parse(fixesContent);
          if (Array.isArray(fixes)) {
            attemptedFixHashes = new Set(fixes);
          }
        } catch {
          logger.warn('Could not load attempted fixes file; treating as empty');
        }
      }

      const topIssuesCap = config.top_issues_cap ?? 10;
      const topIssues = allFindings
        .map(({ finding, dimensionId, weight }) => {
          const priorityScore = weight * finding.severity;
          const fixHash = createHash('sha256')
            .update(JSON.stringify(finding.suggested_fix))
            .digest('hex');
          return {
            rank: 0,
            criterion_id: finding.id,
            dimension_id: dimensionId,
            priority_score: priorityScore,
            score: finding.score as number,
            severity: finding.severity,
            fix: finding.suggested_fix,
            fix_hash: fixHash,
            expected_impact: null,
          };
        })
        .filter((issue) => !attemptedFixHashes.has(issue.fix_hash))
        .sort((a, b) => b.priority_score - a.priority_score)
        .slice(0, topIssuesCap)
        .map((issue, i) => ({ ...issue, rank: i + 1 }));

      // Ship-ready indicator (US2 - T042)
      const shipThreshold = config.ship_threshold ?? 75;
      const shipReady = blocking.length === 0 && compositeScore >= shipThreshold;

      // No-progress detection (US5 - T061)
      let delta: number | null = null;
      let noProgress = false;
      if (options.previousComposite !== undefined) {
        delta = compositeScore - options.previousComposite;
        noProgress = Math.abs(delta) < 3;
      }

      // Build evaluation result
      const result = {
        schema_version: '1.1.0',
        rubric_version: V1_RUBRIC.rubric_version,
        run_id: randomUUID(),
        timestamp: new Date().toISOString(),
        target: {
          url,
          content_hash: captureResult.content_hash,
          captured_at: captureResult.captured_at,
          settle_timeout_ms: config.settle_timeout_ms ?? 30000,
        },
        composite_score: compositeScore,
        ship_ready: shipReady,
        no_progress: noProgress,
        blocking,
        dimensions: dimensionResults,
        top_issues: topIssues,
        pixel_comparison:
          pixelComparisonOutput.length > 0 ? { viewports: pixelComparisonOutput } : null,
        meta: {
          cli_version: '0.0.0',
          rubric_version: V1_RUBRIC.rubric_version,
          tool_versions: Object.fromEntries(
            Object.entries(V1_RUBRIC.tool_versions).map(([k, v]) => [
              k,
              { pinned: v, resolved: v },
            ]),
          ),
          determinism: 'pinned' as const,
          tool_version_drift: null,
          redaction: redactionEnabled ? ('enabled' as const) : ('disabled' as const),
          effective_config: {
            weights: effectiveWeights,
            blocking_toggles: Object.fromEntries(
              V1_RUBRIC.dimensions.flatMap((d) =>
                d.sub_criteria.filter((s) => s.blocking_if_zero).map((s) => [s.id, true]),
              ),
            ),
            viewports: config.viewports ?? {
              desktop: { width: 1280, height: 800 },
              mobile: { width: 375, height: 812 },
            },
            ship_threshold: shipThreshold,
            iteration_cap: config.iteration_cap ?? 5,
            top_issues_cap: topIssuesCap,
            tool_fallback_policy: config.tool_fallback_policy ?? 'fail-fast',
            pixelmatch_threshold: config.pixelmatch_threshold ?? 0.1,
          },
          iteration: options.iteration ?? null,
          previous_composite: options.previousComposite ?? null,
          delta,
          attempted_fixes_count: attemptedFixHashes.size,
          duration_ms: Date.now() - startTime,
        },
      };

      // Generate the evaluation-results artifact bundle (US: artifact output).
      // Always written when --artifact-dir is supplied: with a reference image it
      // includes the per-viewport visuals, otherwise it is a data-only bundle
      // (manifest.json + report.html with the scores, top issues and verdict).
      if (options.artifactDir) {
        const { writeArtifact } = await import('../artifact/index.js');
        const artifact = await writeArtifact({
          dir: options.artifactDir,
          result,
          viewports: artifactViewportInputs,
        });
        (result as Record<string, unknown>).artifact = artifact;
        if (artifactViewportInputs.length === 0) {
          logger.info(
            `Artifact bundle written to ${artifact.dir} (data only — no reference image supplied, so no visual artifacts)`,
          );
        } else {
          logger.info(`Artifact bundle written to ${artifact.dir}`);
        }
      }

      // Validate output against schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validation = validateOutput(result as any);
      if (!validation.valid) {
        logger.error(`Output schema validation failed: ${validation.errors.join('; ')}`);
        process.exit(1);
      }

      // Persist debug artifacts
      if (options.debugDir) {
        const debugDir = resolve(options.debugDir);
        await mkdir(debugDir, { recursive: true, mode: 0o700 });

        for (const [name, buffer] of captureResult.screenshots) {
          await writeFile(resolve(debugDir, `screenshot-${name}.png`), buffer);
        }
        for (const vp of artifactViewportInputs) {
          await writeFile(resolve(debugDir, `reference-${vp.viewport}.png`), vp.referenceBuffer);
        }
        await writeFile(resolve(debugDir, 'dom-snapshot.html'), domSnapshot);
        if (captureResult.har) {
          await writeFile(
            resolve(debugDir, 'recording.har'),
            JSON.stringify(captureResult.har, null, 2),
          );
        }
        await writeFile(
          resolve(debugDir, 'console-errors.json'),
          JSON.stringify(captureResult.console_errors, null, 2),
        );
        logger.info(`Debug artifacts saved to ${debugDir}`);
      }

      // Route output
      const { routeJsonOutput, routeSummary } = await import('../output/index.js');
      const { formatSummary } = await import('../output/index.js');

      const jsonStr = JSON.stringify(result, null, 2);
      await routeJsonOutput(jsonStr, { outFile: options.out });

      const summary = formatSummary(compositeScore, blocking.length, topIssues.length, shipReady);
      routeSummary(summary, { outFile: options.out });

      logger.info(`Evaluation complete in ${Date.now() - startTime}ms`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });
