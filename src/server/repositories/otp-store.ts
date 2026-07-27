import { db } from '@/server/db';
import type { IssuedOtp, OtpStore } from '@/ports/OtpStore';

/** Реализация OtpStore на Prisma. */
export class PrismaOtpStore implements OtpStore {
  async issue(email: string, codeHash: string, expiresAt: Date): Promise<void> {
    await db.emailOtp.create({ data: { email, codeHash, expiresAt } });
  }

  async findLatestActive(email: string): Promise<IssuedOtp | null> {
    const record = await db.emailOtp.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, expiresAt: true, attempts: true },
    });

    return record ?? null;
  }

  async incrementAttempts(id: string): Promise<void> {
    await db.emailOtp.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async consumeAll(email: string): Promise<void> {
    await db.emailOtp.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
