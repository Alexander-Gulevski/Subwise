import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Аудит изменений состояний подписок — NFR-03.
 *
 * Пишется на каждый переход состояния. Нужен и для разбора инцидентов,
 * и для ответа пользователю на вопрос «почему подписка отменена».
 *
 * Суммы и заметки в аудит НЕ попадают (T11): для восстановления
 * картины хватает статусов и дат.
 */

export type AuditAction =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.deleted'
  | 'subscription.restored'
  | 'subscription.cancelled'
  | 'import.connected'
  | 'import.revoked'
  | 'account.deletion_requested';

export async function writeAudit(params: {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: params.ip ?? null,
      },
    });
  } catch (error) {
    // Отказ аудита не должен отменять само действие пользователя:
    // потеря записи в журнале — меньшее зло, чем неотменённая подписка.
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'не удалось записать аудит',
        action: params.action,
        entityId: params.entityId,
        error: String(error),
      }),
    );
  }
}
