import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // mobile/ is a self-contained Expo (React Native) app with its own ESLint
  // config; the web toolchain must never lint RN code. archived/ holds features
  // cut from v1 whose code is expected not to compile.
  globalIgnores(['dist', 'mobile', 'archived', 'apps/web/.next']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  ...nextCoreWebVitals.map((config) => ({
    ...config,
    ...(config.files === undefined
      ? { files: ['apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}'] }
      : { files: config.files.map((pattern) => `apps/web/${pattern}`) }),
  })),
])
