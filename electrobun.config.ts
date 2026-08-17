import type { ElectrobunConfig } from 'electrobun';
import pkg from './package.json';

export default {
  app: {
    name: 'desmos-ide',
    identifier: 'dev.desmoside.app',
    version: pkg.version,
    description: 'an ide for Desmos with a custom dsl',
    urlSchemes: ['dsmx'],
    fileAssociations: [
      { ext: ['dsmx'], name: 'Desmos DSL Document', role: 'Editor' },
    ],
  },
  build: {
    bun: { entrypoint: 'bun/index.ts' },
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets': 'views/mainview/assets',
      'dist/vendor': 'views/mainview/vendor',
      'dist/fonts': 'views/mainview/fonts',
      'dist/native': 'bun/native',
    },
    watchIgnore: ['dist/**'],
    mac: { bundleCEF: false },
    win: { bundleCEF: false },
    linux: { bundleCEF: false },
  },
} satisfies ElectrobunConfig;
