import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'renderer'),

  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve(__dirname, 'renderer/index.html') },
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/monaco-editor')) return 'monaco';
          if (id.includes('node_modules/katex')) return 'katex';
        },
      },
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
