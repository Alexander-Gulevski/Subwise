import type { Config } from 'tailwindcss';

const config: Config = {
  // Следуем системной настройке. Переключатель появится на M2 —
  // тогда стратегия сменится на 'class' вместе с хранением выбора.
  darkMode: 'media',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Токены темы задаются CSS-переменными в globals.css,
        // чтобы светлая и тёмная схемы жили в одном месте.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
      },
      borderRadius: {
        card: '14px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        // Минимальная область нажатия — NFR-02 / docs/05-ux-flows.md
        tap: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
