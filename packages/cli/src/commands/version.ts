import { Command } from 'commander';

export const versionCommand = new Command('version')
  .description('Print CLI version, rubric version, and pinned tool versions')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const { V1_RUBRIC } = await import('@webui-rubric/core');

    const info = {
      cli_version: '0.0.0',
      rubric_version: V1_RUBRIC.rubric_version,
      tool_versions: V1_RUBRIC.tool_versions,
    };

    if (options.json) {
      process.stdout.write(JSON.stringify(info, null, 2) + '\n');
    } else {
      process.stdout.write(`CLI Version: ${info.cli_version}\n`);
      process.stdout.write(`Rubric Version: ${info.rubric_version}\n`);
      process.stdout.write('Tool Versions:\n');
      for (const [tool, version] of Object.entries(info.tool_versions)) {
        process.stdout.write(`  ${tool}: ${version}\n`);
      }
    }
  });
