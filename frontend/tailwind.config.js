/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: { deep: 'var(--bg-primary)', surface: 'var(--bg-secondary)', card: 'var(--bg-secondary)' },
        glass: { DEFAULT: 'var(--bg-secondary)', m: 'var(--bg-tertiary)', s: 'var(--bg-tertiary)' },
        border: { DEFAULT: 'var(--border-color)', heavy: 'var(--accent-border)' },
        t1: 'var(--text-primary)', t2: 'var(--text-secondary)', t3: 'var(--text-tertiary)',
        accent: { DEFAULT: 'var(--accent-color)', dim: 'var(--accent-dim)', strong: 'var(--accent-border)' },
        green: 'var(--green)', red: 'var(--red)',
      },
      borderRadius: { glass: '16px', bubble: '22px', pill: '28px' },
      backdropBlur: { glass: '20px', heavy: '36px' },
      fontFamily: { sans: ['Inter', 'Noto Sans SC', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
};
