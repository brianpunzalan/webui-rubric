import { Command } from 'commander';

export const validateConfigCommand = new Command('validate-config')
  .description('Validate a project configuration file without running an evaluation')
  .option('--config <path>', 'Path to config file', '.webui-rubric.yml')
  .action(async (options: { config: string }) => {
    const { validateProjectConfig, validateWeights } = await import('@webui-rubric/core');
    const { V1_RUBRIC } = await import('@webui-rubric/core');
    const { loadConfigFile } = await import('../config/index.js');

    try {
      const raw = await loadConfigFile(options.config);
      const result = validateProjectConfig(raw);

      if (!result.valid) {
        for (const err of result.errors) {
          process.stderr.write(`Error: ${err}\n`);
        }
        process.exit(2);
      }

      // Additional weight validation
      if (result.config?.weights) {
        const weightErrors = validateWeights(result.config.weights, V1_RUBRIC, result.config.weight_overrides_ack);
        if (weightErrors.length > 0) {
          for (const err of weightErrors) {
            process.stderr.write(`Error: ${err}\n`);
          }
          process.exit(2);
        }
      }

      process.stdout.write('Configuration is valid.\n');
    } catch (error) {
      process.stderr.write(`Error reading config: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(2);
    }
  });
