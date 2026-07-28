import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OnboardingFlow } from '@/components/features/onboarding/onboarding-flow';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';
import { getPopularServices } from '@/server/services/catalog-service';

export const metadata: Metadata = { title: 'Начало работы' };

/**
 * Онбординг — FR-01.
 *
 * Доступен только тому, кто его ещё не проходил: вернуться сюда
 * позже незачем, а случайный переход по ссылке не должен предлагать
 * заново завести уже добавленные подписки.
 */
export default async function OnboardingPage() {
  const user = await requireUser();

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: { onboardedAt: true },
  });

  if (settings?.onboardedAt) redirect('/app');

  const services = await getPopularServices();

  return (
    <OnboardingFlow
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        categorySlug: service.categorySlug,
        defaultPlan: service.defaultPlan,
      }))}
    />
  );
}
