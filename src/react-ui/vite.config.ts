import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/continuous-evolutionary-particle-computation/',
  build: { outDir: 'dist' },
  resolve: {
    alias: {
      '@worker': resolve(__dirname, '..', 'web-worker', 'src', 'worker.ts'),
      // Option 1: Manual alias for the root (requires each sub‑package to end with '/src')
      '@cepc': resolve(__dirname, '..', '..', 'src'),
      // Option 2: Use a plugin like `vite-tsconfig-paths` to auto‑map all paths from tsconfig.json
      //   (then you would also need to install and add the plugin)
    }
  }
});