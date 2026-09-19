import base from './eslint.config.js';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  ...base,
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { sonarjs },
    rules: {
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      // Design signals need review; existing complexity is not an automatic merge veto.
      'sonarjs/cognitive-complexity': ['warn', 20],
    },
  },
];
