import { EmailOtpAuthProvider } from '@/adapters/auth/email-otp/email-otp-auth';
import { SmtpOtpMailer } from '@/adapters/auth/email-otp/mailer';
import { TelegramAuthProvider } from '@/adapters/auth/telegram/telegram-auth';
import { PrismaOtpStore } from '@/server/repositories/otp-store';
import type { AuthProvider } from '@/ports/AuthProvider';

/**
 * Сборка провайдеров авторизации.
 *
 * Единственное место, где конкретные адаптеры соединяются со своими
 * зависимостями. Точки входа работают с типом AuthProvider и не знают,
 * что стоит за ним — поэтому добавление Яндекс ID или VK ID
 * не затронет ни один route (ADR-0003).
 */

let emailOtp: AuthProvider | null = null;
let telegram: AuthProvider | null = null;

export function getEmailOtpProvider(): AuthProvider {
  if (!emailOtp) {
    emailOtp = new EmailOtpAuthProvider(new PrismaOtpStore(), new SmtpOtpMailer());
  }
  return emailOtp;
}

export function getTelegramProvider(): AuthProvider {
  if (!telegram) {
    telegram = new TelegramAuthProvider();
  }
  return telegram;
}
