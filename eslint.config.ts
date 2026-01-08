import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import tsDocPlugin from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

// Safely extract Vitest's recommended rules with concrete typing,
// avoiding any/unknown in the config object.
const vitestRecommendedRules = (
  vitest.configs as unknown as {
    recommended: { rules: Record<string, unknown> };
  }
).recommended.rules;

export default defineConfig([
  // Global ignores (keep ESLint away from build/cache JS)
  {
    ignores: [
      'coverage/**/*',
      'dist/**/*',
      'docs/**/*',
      '.rollup.cache/**/*',
      '**/*.js',
      'test-d/**/*',
    ],
  },
  // Base + strict type-checked rules
  {
    files: [
      'src/**/*.ts',
      'test/**/*.ts',
      'rollup.config.ts',
      'vitest.config.ts',
    ],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      prettierConfig,
    ],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSortPlugin,
      tsdoc: tsDocPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': 'error',
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'tsdoc/syntax': 'warn',
      '@typescript-eslint/unified-signatures': 'off',
    },
  },
  // Lint the config itself without type-aware rules to avoid upstream rule crash
  {
    files: ['eslint.config.ts'],
    extends: [eslint.configs.recommended, prettierConfig],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSortPlugin,
      tsdoc: tsDocPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'tsdoc/syntax': 'warn',
      'no-unused-vars': 'off',
    },
  },
  // Vitest rules and globals for test files
  {
    files: ['**/*.test.ts'],
    plugins: {
      vitest: vitest as never,
    },
    rules: {
      ...vitestRecommendedRules,
      // Allow Chai-style chainers provided by Vitest (e.g., .to.equal)
      'vitest/valid-expect': 'off',
      // Tests often use expect(...).to.be.* chains that trip this rule
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
]);
