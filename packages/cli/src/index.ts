#!/usr/bin/env node
import { Command } from 'commander';
import { evaluateCommand } from './commands/evaluate.js';
import { versionCommand } from './commands/version.js';
import { checkToolsCommand } from './commands/check-tools.js';
import { validateConfigCommand } from './commands/validate-config.js';

const program = new Command()
  .name('webui-rubric')
  .description('Deterministic web UI evaluator against a multi-dimensional rubric')
  .version('0.0.0');

program.addCommand(evaluateCommand, { isDefault: true });
program.addCommand(versionCommand);
program.addCommand(checkToolsCommand);
program.addCommand(validateConfigCommand);

program.parse();
