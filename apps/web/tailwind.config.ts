import type { Config } from 'tailwindcss';

// Design tokens from the BozorNarx concept images: Emerald primary, Fresh Green secondary,
// Warm Orange accent, Cream background, Charcoal text. Success/warning/error follow the same family.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
        fresh: { 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
        accent: { 400: '#fb923c', 500: '#f97316', 600: '#ea580c' },
        cream: { 50: '#fffdf8', 100: '#fbf7ee', 200: '#f3ecda', 300: '#e7e0cf' },
        ink: { DEFAULT: '#1f2937', soft: '#4b5563', muted: '#6b7280' },
        warn: '#d97706',
        danger: '#dc2626',
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: { card: '0 1px 2px rgba(31,41,55,.05), 0 8px 24px -12px rgba(4,120,87,.18)' },
      keyframes: {
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
      },
      animation: { shake: 'shake .35s ease-in-out' },
    },
  },
  plugins: [],
};
export default config;
