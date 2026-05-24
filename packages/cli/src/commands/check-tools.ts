import { Command } from 'commander';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function getPackageVersion(packageName: string): string {
  try {
    const pkg = require(`${packageName}/package.json`) as { version: string };
    return pkg.version;
  } catch {
    return 'not found';
  }
}

export const checkToolsCommand = new Command('check-tools')
  .description('Verify installed tool versions match rubric pins')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const { V1_RUBRIC } = await import('@webui-rubric/core');

    const toolPackageMap: Record<string, string> = {
      'axe-core': '@axe-core/playwright',
      lighthouse: 'lighthouse',
      pixelmatch: 'pixelmatch',
      playwright: 'playwright',
    };

    const results: Record<string, { pinned: string; resolved: string; match: boolean }> = {};
    let allMatch = true;

    for (const [tool, pinned] of Object.entries(V1_RUBRIC.tool_versions)) {
      const packageName = toolPackageMap[tool] ?? tool;
      const resolved = getPackageVersion(packageName);
      const match = resolved === pinned;
      if (!match) allMatch = false;
      results[tool] = { pinned, resolved, match };
    }

    if (options.json) {
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else {
      for (const [tool, info] of Object.entries(results)) {
        const status = info.match ? '✓' : '✗';
        process.stdout.write(
          `${status} ${tool}: pinned=${info.pinned} resolved=${info.resolved}\n`,
        );
      }
    }

    process.exit(allMatch ? 0 : 3);
  });
