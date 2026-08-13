import type { ElectrobunConfig } from 'electrobun';

export default {
  app: {
    name: 'desmos-ide',
    identifier: 'dev.desmoside.app',
    version: '1.2.4',
    description: 'an ide for Desmos with a custom dsl',
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
    },
    watchIgnore: ['dist/**'],
    mac: { bundleCEF: false },
    win: { bundleCEF: false },
    linux: { bundleCEF: false },
  },
} satisfies ElectrobunConfig;
