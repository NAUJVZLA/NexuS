'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mockDb, Negocio } from '@/lib/supabaseClient';

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [negocioInfo, setNegocioInfo] = useState<Negocio | null>(null);

  useEffect(() => {
    const checkSubscription = () => {
      try {
        const sessionStr = localStorage.getItem('alico_session');
        if (!sessionStr) {
          setLoading(false);
          return;
        }

        const session = JSON.parse(sessionStr);
        
        // El Super Admin no tiene restricciones de negocio/suscripción
        if (session.role === 'super_admin') {
          setIsSuspended(false);
          setLoading(false);
          return;
        }

        const negocioId = session.negocio_id;
        if (!negocioId) {
          setIsSuspended(false);
          setLoading(false);
          return;
        }

        // Buscar el negocio
        const negocios = mockDb.getNegocios();
        const negocio = negocios.find(n => n.id === negocioId);

        if (negocio) {
          setNegocioInfo(negocio);
          
          const hoy = new Date().toISOString().split('T')[0];
          const estaVencido = negocio.fecha_vencimiento ? (hoy > negocio.fecha_vencimiento) : false;
          const estaSuspendido = negocio.estado_suscripcion === 'SUSPENDIDO';

          if (estaSuspendido || estaVencido) {
            setIsSuspended(true);
          } else {
            setIsSuspended(false);
          }
        }
      } catch (e) {
        console.error('Error al validar la suscripción del negocio:', e);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
    // Escuchar cambios de estado
    window.addEventListener('sedeChanged', checkSubscription);
    window.addEventListener('focus', checkSubscription);
    
    return () => {
      window.removeEventListener('sedeChanged', checkSubscription);
      window.removeEventListener('focus', checkSubscription);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-t-2 border-amber-500 animate-spin"></div>
        </div>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card rounded-3xl p-8 border border-white/5 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl -z-10"></div>
          
          {/* Icono de Alerta */}
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-white uppercase tracking-wider">Acceso Suspendido</h1>
            <p className="text-xs text-zinc-400">
              La cuenta de <strong className="text-amber-500">{negocioInfo?.nombre || 'tu establecimiento'}</strong> no se encuentra activa.
            </p>
          </div>

          <div className="glass-card bg-white/5 border border-white/5 rounded-2xl p-4 text-left space-y-2">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Razón:</span>
              <span className="text-white font-bold">
                {negocioInfo?.estado_suscripcion === 'SUSPENDIDO' ? 'Suspensión de cuenta' : 'Suscripción expirada'}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Fecha Límite:</span>
              <span className="text-white font-mono">
                {negocioInfo?.fecha_vencimiento || 'N/A'}
              </span>
            </div>
          </div>

          <div className="text-xs text-zinc-500 leading-relaxed">
            Por favor, ponte en contacto con el administrador del sistema o realiza el pago de renovación para reactivar la plataforma y continuar con las ventas.
          </div>

          <div className="pt-2">
            <a
              href="mailto:soporte@nexus.com"
              className="inline-flex items-center justify-center w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs transition-all shadow-[0_4px_15px_rgba(245,158,11,0.2)]"
            >
              Contactar a Soporte
            </a>
            <button
              onClick={() => {
                localStorage.removeItem('alico_session');
                router.replace('/login');
              }}
              className="mt-3 text-[10px] text-zinc-500 hover:text-white underline transition-all uppercase tracking-widest font-bold block mx-auto"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
