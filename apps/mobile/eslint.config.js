// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// eslint-config-expo enables eslint-import-resolver-typescript, which does not load
// under ESLint 10. Imports are fully checked by tsc, so the plain node resolver is enough.
const withoutTsResolver = expoConfig.map((block) => {
  const resolver = block.settings?.['import/resolver'];
  if (!resolver || typeof resolver !== 'object' || !('typescript' in resolver)) return block;
  const { typescript: _drop, ...rest } = resolver;
  return { ...block, settings: { ...block.settings, 'import/resolver': rest } };
});

module.exports = defineConfig([
  withoutTsResolver,
  {
    ignores: ['dist/*', '.expo/*', 'web-build/*', 'coverage/*'],
  },
  {
    settings: {
      // eslint-plugin-react cannot auto-detect the version under ESLint 10.
      react: { version: '19.3' },
    },
    // tsc checks imports and named exports more accurately than eslint-plugin-import.
    rules: { 'import/no-unresolved': 'off', 'import/namespace': 'off', 'import/named': 'off' },
  },
  {
    files: ['__tests__/**', 'test/**', 'jest.config.js'],
    languageOptions: {
      globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' },
    },
  },
]);
