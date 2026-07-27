'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getDictionary } from '@/locales';

const t = getDictionary('ru');

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" onClick={logout} disabled={pending}>
      {pending ? t.common.loading : t.auth.logout}
    </Button>
  );
}
