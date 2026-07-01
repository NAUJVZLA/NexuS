'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirección inteligente basada en la sesión del usuario
    const sessionStr = localStorage.getItem('alico_session');
    if (!sessionStr) {
      router.replace('/login');
      return;
    }

    try {
      const session = JSON.parse(sessionStr);
      if (session.role === 'super_admin') {
        router.replace('/super-admin');
      } else if (session.role === 'admin') {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    } catch (e) {
      localStorage.removeItem('alico_session');
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#030303]">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Sleek Golden Spinner */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#f59e0b]/20 border-t-[#f59e0b]"></div>
        <p className="text-sm font-medium tracking-wide text-zinc-400">
          Iniciando NexuS Gastro Bar...
        </p>
      </div>
    </div>
  );
}
