import { PrismaClient } from '@prisma/client';
import { categories } from './categories';
import { featureFlags } from './feature-flags';
import { services } from './services';

/**
 * Сид базы. Идемпотентен — запускается повторно без побочных эффектов.
 *
 *   npm run db:seed
 *
 * На M2 сюда добавляются гиды отмены (зона агента catalog-curator).
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

  console.log('Сид: каталог сервисов…');
  const categoryIds = new Map(
    (await db.category.findMany({ select: { id: true, slug: true } })).map(
      (category) => [category.slug, category.id],
    ),
  );

  let plansCount = 0;

  for (const service of services) {
    const categoryId = categoryIds.get(service.categorySlug);
    if (!categoryId) {
      throw new Error(
        `Сервис ${service.slug} ссылается на неизвестную категорию ${service.categorySlug}`,
      );
    }

    const defaults = service.plans.filter((plan) => plan.isDefault);
    if (defaults.length !== 1) {
      // Ровно один тариф по умолчанию — иначе форма не знает,
      // что подставлять (.claude/agents/catalog-curator.md)
      throw new Error(
        `Сервис ${service.slug}: тарифов по умолчанию ${defaults.length}, должен быть ровно один`,
      );
    }

    const saved = await db.service.upsert({
      where: { slug: service.slug },
      update: {
        name: service.name,
        aliases: service.aliases,
        categoryId,
        websiteUrl: service.websiteUrl ?? null,
        isActive: true,
      },
      create: {
        slug: service.slug,
        name: service.name,
        aliases: service.aliases,
        categoryId,
        websiteUrl: service.websiteUrl ?? null,
      },
      select: { id: true },
    });

    // Тарифы пересоздаются целиком: цены меняются, и проще заменить
    // набор, чем сопоставлять записи по неустойчивому имени
    await db.servicePlan.deleteMany({ where: { serviceId: saved.id } });
    await db.servicePlan.createMany({
      data: service.plans.map((plan) => ({
        serviceId: saved.id,
        name: plan.name,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        period: plan.period,
        isDefault: plan.isDefault ?? false,
      })),
    });

    plansCount += service.plans.length;
  }

  console.log(
    `Готово: ${categories.length} категорий, ${featureFlags.length} фиче-флагов, ` +
      `${services.length} сервисов, ${plansCount} тарифов.`,
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
