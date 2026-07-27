import { PrismaClient } from '@prisma/client';
import { categories } from './categories';
import { featureFlags } from './feature-flags';

/**
 * Сид базы. Идемпотентен — запускается повторно без побочных эффектов.
 *
 *   npm run db:seed
 *
 * На этапе M1 сюда добавляются сервисы каталога и гиды отмены
 * (зона агента catalog-curator), а также демо-пользователь
 * с подписками во всех пяти состояниях.
 */

const db = new PrismaClient();

async function main() {
  console.log('Сид: категории…');
  for (const category of categories) {
    await db.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, icon: category.icon },
      create: { ...category, isSystem: true },
    });
  }

  console.log('Сид: фиче-флаги…');
  for (const flag of featureFlags) {
    await db.featureFlag.upsert({
      where: { key: flag.key },
      update: { requiredPlan: flag.requiredPlan, description: flag.description },
      create: { ...flag, isEnabled: true },
    });
  }

  console.log(
    `Готово: ${categories.length} категорий, ${featureFlags.length} фиче-флагов.`,
  );
}

main()
  .catch((error) => {
    console.error('Сид упал:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
