import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const evaluateCommand = new Command('evaluate')
  .description('Evaluate a live web UI against the rubric')
  .argument('<url>', 'Fully qualified URL of the target web UI')
  .option('--config <path>', 'Path to project configuration file', '.webui-rubric.yml')
  .option('--out <path>', 'Write JSON artifact to file instead of stdout')
  .option('--reference <path>', 'Reference design image (PNG) for pixel comparison')
  .option('--reference-viewport <name>', 'Which viewport the reference image represents', 'desktop')
  .option('--viewports <list>', 'Comma-separated viewport names to capture', 'desktop,mobile')
  .option('--debug-dir <path>', 'Directory for debug artifacts')
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

      // Capture phase
      logger.info('Starting capture phase...');
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

      const captureResult = await capturePage(url, {
        settleTimeoutMs: config.settle_timeout_ms ?? 30000,
        additionalSettleDelay: 5000,
        deviceScaleFactor: 1,
        autoDismiss: config.capture?.auto_dismiss ?? true,
        dismissSelectors: config.capture?.dismiss_selectors,
        viewports: viewportSpecs.length > 0 ? viewportSpecs : undefined,
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
        logger.info('Lighthouse checks complete.');
      } catch (error) {
        logger.warn(`Lighthouse failed: ${error instanceof Error ? error.message : 'unknown'}`);
      }

      // Reference image pixel comparison
      const pixelComparisonResults: Map<
        string,
        { score: number; diffRatio: number; evidence: string }
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
      }> = [];

      if (options.reference) {
        const refPath = resolve(options.reference);
        if (!existsSync(refPath)) {
          logger.error(`Reference image not found: ${refPath}`);
          process.exit(2);
        }

        const { loadReferenceImage } = await import('@webui-rubric/capture');
        const { runPixelmatch, scoreFromDiffRatio } = await import('@webui-rubric/checks');

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
              });
            }
          }
        }

        logger.info(`Pixelmatch complete: ${pctDiff}% diff, score ${vpScore}/4`);
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
            if (pmResult) {
              return {
                id: sub.id,
                name: sub.name,
                score: pmResult.score,
                status: 'scored' as const,
                evidence: pmResult.evidence,
                evidence_source: checkId,
                severity: pmResult.score < 4 ? 4 - pmResult.score : 0,
                suggested_fix:
                  pmResult.score < 4
                    ? ['Reduce pixel differences to match reference design more closely']
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
        schema_version: '1.0.0',
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
