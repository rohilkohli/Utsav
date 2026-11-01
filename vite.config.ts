import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@client': path.resolve(__dirname, 'src/client'),
    },
  },
  build: {
    outDir: 'dist/client',
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, report) {
        // Zod's prose comments mention PURE annotations; Rollup safely discards those comments.
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('/node_modules/zod/')) {
          return;
        }
        report(warning);
      },
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        xfwd: true,
        ws: true,
      },
    },
  },
});
