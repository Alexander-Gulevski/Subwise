import { getEnv } from '@/lib/env';

/**
 * Воркер фоновых задач — отдельный процесс (ADR-0006).
 *
 * На M0 это заглушка: процесс поднимается, подключается к Redis
 * и держится живым. Полноценный планировщик уведомлений приходит
 * на M2 (docs/08-roadmap.md).
 *
 * Ключевое требование к любой будущей задаче — идемпотентность:
 * повторный запуск не должен создавать дублей (NFR-05).
 */

async function main(): Promise<void> {
  const env = getEnv();

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'worker started',
      redis: new URL(env.REDIS_URL).host,
      // Строки подключения и секреты в логи не попадают (T11)
    }),
  );

  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ level: 'info', msg: 'worker stopping', signal }));
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Держим процесс живым до появления реальных очередей на M2.
  await new Promise<never>(() => {});
}

main().catch((error) => {
  console.error(
    JSON.stringify({ level: 'error', msg: 'worker crashed', error: String(error) }),
  );
  process.exit(1);
});
