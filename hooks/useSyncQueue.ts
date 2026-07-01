'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { syncService } from '@/lib/syncService';

export function useSyncQueue() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<{
    tabla: string;
    tipo_operacion: string;
    code: string;
    message: string;
  } | null>(null);
  const [dbError, setDbError] = useState<{
    tabla: string;
    message: string;
  } | null>(null);

  // Consulta el conteo actual de operaciones en la cola
  const updatePendingCount = async () => {
    if (!db) return;
    try {
      const count = await db.cola_sincronizacion.count();
      setPendingCount(count);
    } catch (e) {
      console.error('Error obteniendo conteo de cola:', e);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Inicializar el conteo de la cola
    updatePendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      setSyncError(null);
      setDbError(null);
      try {
        const { syncFromSupabase } = await import('@/lib/supabaseClient');
        await syncFromSupabase();
      } catch (err) {
        console.error('Fallo en sincronización al reconectar:', err);
      } finally {
        await updatePendingCount();
        setIsSyncing(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSyncUpdate = () => {
      updatePendingCount();
    };

    const handleSyncError = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSyncError(customEvent.detail);
      }
    };

    const handleDbError = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDbError(customEvent.detail);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync_queue_updated', handleSyncUpdate);
    window.addEventListener('sync_error_occurred', handleSyncError);
    window.addEventListener('db_error_occurred', handleDbError);

    // Intervalo de auto-reintento periódico en segundo plano
    const autoRetryInterval = setInterval(async () => {
      if (navigator.onLine && db) {
        try {
          const count = await db.cola_sincronizacion.count();
          if (count > 0) {
            console.log(`[Alico Polling] Reintentando sincronizar ${count} cambios pendientes en segundo plano...`);
            const { syncFromSupabase } = await import('@/lib/supabaseClient');
            await syncFromSupabase();
            await updatePendingCount();
          }
        } catch (e) {
          console.error('[Alico Polling] Error en intervalo de auto-reintento:', e);
        }
      }
    }, 15000); // Reintentar cada 15 segundos

    // Si detectamos que está online al arrancar, programar una sincronización inicial
    if (navigator.onLine) {
      // Breve retraso para que Next.js se hidrate por completo
      const timer = setTimeout(() => {
        handleOnline();
      }, 1500);
      return () => {
        clearTimeout(timer);
        autoRetryInterval && clearInterval(autoRetryInterval);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('sync_queue_updated', handleSyncUpdate);
        window.removeEventListener('sync_error_occurred', handleSyncError);
        window.removeEventListener('db_error_occurred', handleDbError);
      };
    }

    return () => {
      autoRetryInterval && clearInterval(autoRetryInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync_queue_updated', handleSyncUpdate);
      window.removeEventListener('sync_error_occurred', handleSyncError);
      window.removeEventListener('db_error_occurred', handleDbError);
    };
  }, []);

  const forceSync = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    setIsSyncing(true);
    setSyncError(null);
    setDbError(null);
    try {
      const { syncFromSupabase } = await import('@/lib/supabaseClient');
      await syncFromSupabase();
    } catch (err) {
      console.error('Fallo en sincronización manual:', err);
    } finally {
      await updatePendingCount();
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    pendingCount,
    isSyncing,
    forceSync,
    syncError,
    dbError,
  };
}
