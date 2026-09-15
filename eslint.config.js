import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**', '.test-data/**', '.local/**', 'coverage/**'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/**/*.{js,jsx}', 'public/*.js'],
    languageOptions: { globals: globals.browser },
    // Vite uses the classic React.createElement JSX transform.
    rules: {
      'no-unused-vars': [
        'error',
        { varsIgnorePattern: '^React$|^_', argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  // Integration tests execute callbacks inside Playwright's browser context.
  { files: ['test/**/*.mjs'], languageOptions: { globals: globals.browser } },
];
