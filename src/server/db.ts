import { PrismaClient } from '@prisma/client';

/**
 * Единственный экземпляр Prisma.
 *
 * В dev Next.js перезагружает модули на каждое изменение — без кэша
 * в globalThis это открывало бы новый пул соединений при каждом сохранении.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
