import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    base: '/continuous-evolutionary-particle-computation/',
    build: { outDir: 'dist' },
    resolve: {
        alias: {
            '@worker': resolve(__dirname, '..', 'web-worker', 'src', 'worker.ts')
        }
    }
});
