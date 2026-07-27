import type { Config } from 'tailwindcss';

/**
 * Дизайн-система — docs/10-design-system.md.
 * Значения токенов живут в globals.css, здесь только имена.
 */
const config: Config = {
  // Следуем системной настройке. Переключатель появится на M2 —
  // тогда стратегия сменится на 'class' вместе с хранением выбора.
  darkMode: 'media',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-raised': 'rgb(var(--surface-raised) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',

        // Зелёный: действия пользователя, экономия, успех
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'accent-text': 'rgb(var(--accent-text) / <alpha-value>)',

        // Фиолетовый: расширенный тариф и его функции
        pro: 'rgb(var(--pro) / <alpha-value>)',
        'pro-fg': 'rgb(var(--pro-fg) / <alpha-value>)',
        'pro-soft': 'rgb(var(--pro-soft) / <alpha-value>)',
        'pro-text': 'rgb(var(--pro-text) / <alpha-value>)',

        warn: 'rgb(var(--warn) / <alpha-value>)',
        'warn-soft': 'rgb(var(--warn-soft) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--danger-soft) / <alpha-value>)',
      },
      borderRadius: {
        // Скругления: крупные у контейнеров, мелкие у управления.
        // Разница делает иерархию читаемой без линий и теней.
        card: '16px',
        control: '10px',
        chip: '8px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        // Минимальная область нажатия — NFR-02
        tap: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
