// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // TypeScript já valida redeclaração; o padrão const + type de mesmo nome é intencional (ex.: RemoteKey).
    rules: { '@typescript-eslint/no-redeclare': 'off' },
  },
]);
