import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

const code = ['**/*.{js,jsx,mjs,ts,tsx}'];
const components = ['src/**/*.{jsx,tsx}'];

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.wrangler/**',
      'public/**',
      'src/tools/uuid/vendor/**',
    ],
  },
  {
    files: code,
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      tseslint.configs.stylistic,
      stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: true,
        jsx: true,
      }),
    ],
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@stylistic/indent': ['error', 2],
      '@stylistic/jsx-indent-props': ['error', 2],
      '@stylistic/no-tabs': 'error',
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-alert': 'error',
      'no-console': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{mjs,ts}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/tools/uuid/webmcp.js'],
    rules: { 'no-console': ['error', { allow: ['warn'] }] },
  },
  {
    files: ['src/tools/box/App.tsx'],
    // 保留已有的“恢复示例”确认交互。
    rules: { 'no-alert': 'off' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },
  {
    files: components,
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.strict,
    ],
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['src/tools/flow/App.jsx'],
    rules: {
      // canvas 的图像角色与可访问名称符合 WAI 的用法。
      'jsx-a11y/no-interactive-element-to-noninteractive-role': [
        'error',
        { canvas: ['img'] },
      ],
    },
  },
]);
