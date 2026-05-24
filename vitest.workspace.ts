import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core',
  'packages/cli',
  'packages/capture',
  'packages/checks',
]);
