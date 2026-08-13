import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'renderer'),
  // views:// serves from a bundle dir, so assets must be referenced relatively
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve(__dirname, 'renderer/index.html') },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  optimizeDeps: {
    exclude: ['monaco-editor'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
