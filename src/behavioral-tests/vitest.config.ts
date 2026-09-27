import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// The behavioral test suite's data files and spec live in the repo-root
// tests/behavioral/ directory (shared with tools/validate-trajectory.js and
// documented in docs/phases/04-phase4.md), not inside this package. This
// package exists only to give the suite a pnpm workspace entry point.
//
// Because the spec file lives outside src/behavioral-tests/, plain
// node_modules resolution of '@cepc/shared-config' / '@cepc/cpu-reference'
// (bare specifiers) from that file's location does not find the workspace
// symlinks pnpm creates for this package's own declared dependencies —
// those only resolve correctly for files inside this package's own
// directory tree. Aliasing directly to source sidesteps that.
export default defineConfig({
  resolve: {
    alias: {
      '@cepc/shared-config': resolve(__dirname, '../shared-config/src/index.ts'),
      '@cepc/cpu-reference': resolve(__dirname, '../cpu-reference/src/index.ts')
    }
  },
  test: {
    include: ['../../tests/behavioral/*.test.ts'],
    globals: true
  }
});