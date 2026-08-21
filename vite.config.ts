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
      output: {
        // the editor and the math renderer are the two big libraries, and neither
        // changes when app code does, so they get their own files
        manualChunks: {
          monaco: ['monaco-editor'],
          katex: ['katex'],
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
