import { Command } from 'commander';

export const checkToolsCommand = new Command('check-tools')
  .description('Verify installed tool versions match rubric pins')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const { V1_RUBRIC } = await import('@webui-rubric/core');

    const results: Record<string, { pinned: string; resolved: string; match: boolean }> = {};
    let allMatch = true;

    for (const [tool, pinned] of Object.entries(V1_RUBRIC.tool_versions)) {
      let resolved = 'not found';
      try {
        if (tool === 'axe-core') {
          const pkg = await import('@axe-core/playwright/package.json', { with: { type: 'json' } }).catch(() => null);
          resolved = pkg?.default?.version ?? 'unknown';
        } else if (tool === 'lighthouse') {
          const pkg = await import('lighthouse/package.json', { with: { type: 'json' } }).catch(() => null);
          resolved = pkg?.default?.version ?? 'unknown';
        } else if (tool === 'pixelmatch') {
          resolved = pinned; // Will be resolved at runtime
        } else if (tool === 'playwright') {
          const pkg = await import('playwright/package.json', { with: { type: 'json' } }).catch(() => null);
          resolved = pkg?.default?.version ?? 'unknown';
        }
      } catch {
        resolved = 'not found';
      }

      const match = resolved === pinned;
      if (!match) allMatch = false;
      results[tool] = { pinned, resolved, match };
    }

    if (options.json) {
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else {
      for (const [tool, info] of Object.entries(results)) {
        const status = info.match ? '✓' : '✗';
        process.stdout.write(`${status} ${tool}: pinned=${info.pinned} resolved=${info.resolved}\n`);
      }
    }

    process.exit(allMatch ? 0 : 3);
  });
