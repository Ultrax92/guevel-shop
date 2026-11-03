// eslint.config.mjs — configuration ESLint commune (flat config) aux services Node et au frontend React
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'docs/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    // Services Node.js (CommonJS)
    files: ['backend/**/*.js', 'gateway/**/*.js', 'microservices/**/*.js', 'scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^(_|next$)' }] },
  },
  {
    // Frontend React (modules ES + JSX)
    files: ['frontend/src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
    },
  },
  {
    files: ['frontend/src/**/*.test.js'],
    languageOptions: { globals: { test: 'readonly', expect: 'readonly', describe: 'readonly', it: 'readonly' } },
  },
  {
    files: ['frontend/*.{js,mjs,cjs}', '*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
];
