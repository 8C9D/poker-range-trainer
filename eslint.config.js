import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // mobile/ is a self-contained Expo (React Native) app with its own ESLint
  // config; the web toolchain must never lint RN code. archived/ holds features
  // cut from v1 whose code is expected not to compile.
  globalIgnores(['dist', 'mobile', 'archived']),
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
  // The web app is the only React tree here: React's own rules plus the
  // accessibility rules, the coverage eslint-config-next used to bring along.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      jsxA11y.flatConfigs.recommended,
    ],
    settings: { react: { version: 'detect' } },
    rules: {
      // The route table exports a plain object next to its page components.
      'react-refresh/only-export-components': 'off',
      // TypeScript types the props; runtime prop-types would only repeat them.
      'react/prop-types': 'off',
    },
  },
])
