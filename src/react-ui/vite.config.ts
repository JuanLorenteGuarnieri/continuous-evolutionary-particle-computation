import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/continuous-evolutionary-particle-computation/',
  build: {
    outDir: 'dist'
  }
});
