import nodemailer from 'nodemailer';
import { getEnv } from '@/lib/env';
import { OTP_LENGTH } from '@/server/auth/crypto';

/**
 * Отправка письма с кодом входа.
 *
 * В development без настроенного SMTP код печатается в консоль —
 * иначе локальная разработка требует почтового сервера.
 * В production отсутствие SMTP — ошибка конфигурации, а не повод
 * молча напечатать секрет в лог.
 */

let transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  const env = getEnv();
  if (!env.SMTP_HOST) return null;

  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    });
  }

  return transport;
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const env = getEnv();
  const mailer = getTransport();

  if (!mailer) {
    if (env.NODE_ENV === 'production') {
      throw new Error('SMTP_HOST не задан — отправка кодов входа невозможна');
    }
    // Только для локальной разработки.
    console.log(`[dev] Код входа для ${email}: ${code}`);
    return;
  }

  await mailer.sendMail({
    from: env.SMTP_FROM ?? 'Отписка <noreply@localhost>',
    to: email,
    subject: `${code} — код для входа в Отписку`,
    text: [
      `Код для входа: ${code}`,
      '',
      'Код действует 10 минут и работает один раз.',
      'Если это были не вы — просто проигнорируйте письмо.',
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px">
        <p style="color:#666;margin:0 0 8px">Код для входа в Отписку</p>
        <p style="font-size:32px;letter-spacing:6px;font-weight:600;margin:0 0 16px">
          ${escapeHtml(code)}
        </p>
        <p style="color:#666;font-size:14px;margin:0">
          Действует 10 минут, работает один раз.<br>
          Если это были не вы — просто проигнорируйте письмо.
        </p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  // Код состоит только из цифр, но экранирование здесь —
  // защита от будущих изменений формата.
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[char] ?? char;
  });
}

export { OTP_LENGTH };
