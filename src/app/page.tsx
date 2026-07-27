import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDictionary } from '@/locales';

const t = getDictionary('ru');

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-5 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">
          {t.brand.name}
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          {t.landing.title}
        </h1>
        <p className="text-lg text-muted">{t.landing.subtitle}</p>
      </header>

      <div>
        <Button asChild size="md">
          <Link href="/login">{t.landing.cta}</Link>
        </Button>
      </div>

      <section aria-labelledby="how-it-works" className="flex flex-col gap-3">
        <h2 id="how-it-works" className="sr-only">
          {t.landing.howItWorks}
        </h2>

        {t.landing.steps.map((step, index) => (
          <Card key={step.title} className="flex gap-4">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
            >
              {index + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted">{step.text}</p>
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
}
