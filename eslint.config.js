import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Thư viện công thức toán nhập từ ngoài (chuyển từ TS sang JSX, giữ nguyên logic gốc).
    // Không sửa code thư viện -> nới rule cho riêng thư mục này.
    files: ['src/components/math/**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
