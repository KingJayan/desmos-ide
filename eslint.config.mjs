import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: [
      'dist/**', 'build/**', 'node_modules/**', 'registry/**', 'docs/**',
      'renderer/public/vendor/**', 'src/monaco/grammar.ts', 'eslint.config.mjs',
      'src/bench/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['scripts/**', 'e2e/**', 'cli/**', 'src/demo.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/tests/**'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' },
  },
);
