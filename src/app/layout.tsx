import type { Metadata, Viewport } from 'next';
import { getDictionary } from '@/locales';
import './globals.css';

const t = getDictionary('ru');

export const metadata: Metadata = {
  title: {
    default: `${t.brand.name} — ${t.brand.tagline}`,
    template: `%s — ${t.brand.name}`,
  },
  description: t.landing.subtitle,
  manifest: '/manifest.webmanifest',
  applicationName: t.brand.name,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Тема следует системной настройке через CSS-медиазапрос.
  // Инлайн-скрипт для раннего применения класса не используется
  // намеренно: dangerouslySetInnerHTML запрещён правилами проекта
  // (docs/06-security-privacy.md, T6). Ручной переключатель темы
  // появится на M2 вместе с настройками — тогда и понадобится
  // безопасный способ прочитать сохранённый выбор.
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
