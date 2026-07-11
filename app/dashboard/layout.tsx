'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { mockDb, Sede, isMockMode } from '@/lib/supabaseClient';
import { useSyncQueue } from '@/hooks/useSyncQueue';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'vendedor' | 'mesero' | 'super_admin'>('admin');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [activeSede, setActiveSede] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'demo' | 'syncing' | 'synced'>(
    isMockMode ? 'demo' : 'syncing'
  );
  const [localDbReady, setLocalDbReady] = useState(false);
  const [negocioInfo, setNegocioInfo] = useState<any>(null);
  const [planExpired, setPlanExpired] = useState(false);
  const [expiryDaysLeft, setExpiryDaysLeft] = useState<number | null>(null);

  const { isOnline, pendingCount, isSyncing, forceSync, syncError, dbError } = useSyncQueue();

  useEffect(() => {
    // 1. Guard de Sesión
    const sessionStr = localStorage.getItem('alico_session');
    if (!sessionStr) {
      router.replace('/login');
      return;
    }

    let negocioId: string | undefined;
    try {
      const session = JSON.parse(sessionStr);
      if (!['admin', 'vendedor', 'mesero'].includes(session.role)) {
        // Si es super_admin va a su propio panel, si no, al login
        if (session.role === 'super_admin') {
          router.replace('/super-admin');
        } else {
          router.replace('/login');
        }
        return;
      }
      setUserName(session.nombre);
      setUserRole(session.role);
      negocioId = session.negocio_id;

      // Guard de rutas según rol
      if (session.role === 'mesero' && pathname !== '/dashboard/mesas') {
        router.replace('/dashboard/mesas');
        return;
      }
      if (session.role === 'vendedor' && !['/dashboard/ventas', '/dashboard/mesas'].includes(pathname)) {
        router.replace('/dashboard/mesas');
        return;
      }
    } catch (e) {
      localStorage.removeItem('alico_session');
      router.replace('/login');
      return;
    }

    // 1.5 Cargar info de suscripción del negocio
    if (negocioId) {
      const allNegocios = mockDb.getNegocios();
      const currentNeg = allNegocios.find(n => n.id === negocioId);
      if (currentNeg) {
        setNegocioInfo(currentNeg);
        
        // Verificar si la suscripción está suspendida
        if (currentNeg.estado_suscripcion === 'SUSPENDIDO') {
          setPlanExpired(true);
        } else if (currentNeg.fecha_vencimiento) {
          const expiryDate = new Date(currentNeg.fecha_vencimiento + 'T23:59:59');
          const today = new Date();
          
          if (today > expiryDate) {
            setPlanExpired(true);
          } else {
            const diffTime = expiryDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 15) {
              setExpiryDaysLeft(diffDays);
            }
          }
        }
      }
    }

    // 2. Cargar Sedes para este negocio
    const loadedSedes = mockDb.getSedes(negocioId);
    setSedes(loadedSedes);

    // 3. Cargar Sede Activa (Validando que exista entre las sedes cargadas)
    const cachedSede = localStorage.getItem('alico_active_sede');
    if (cachedSede && loadedSedes.some(s => s.id === cachedSede)) {
      setActiveSede(cachedSede);
    } else if (loadedSedes.length > 0) {
      const defaultSede = loadedSedes[0].id;
      setActiveSede(defaultSede);
      localStorage.setItem('alico_active_sede', defaultSede);
    }

    // 4. Inicializar Motor de Sincronización Supabase Cloud (Offline-First Cache)
    import('@/lib/supabaseClient').then(async ({ isMockMode, syncFromSupabase, initRealtimeSync, ensureDbInitialized }) => {
      // Garantizar que la base de datos IndexedDB local cargó antes de renderizar la UI
      await ensureDbInitialized();
      setLocalDbReady(true);

      if (isMockMode) {
        setSyncStatus('demo');
      } else {
        setSyncStatus('syncing');
        // Intentar sincronizar datos iniciales desde Supabase
        await syncFromSupabase();
        
        // Activar canal realtime de WebSocket (se reconectará solo si hay cortes de red)
        initRealtimeSync();
        
        // Dejar el estado en synced (producción) independientemente de si falló el sync inicial,
        // para que useSyncQueue reporte correctamente el estado 'Offline' y no 'Modo Demo'.
        setSyncStatus('synced');
        
        // Recargar sedes y sede activa tras inicializar la base de datos local
        const freshSedes = mockDb.getSedes(negocioId);
        setSedes(freshSedes);
        
        const cached = localStorage.getItem('alico_active_sede');
        if (cached && freshSedes.some(s => s.id === cached)) {
          setActiveSede(cached);
        } else if (freshSedes.length > 0) {
          const def = freshSedes[0].id;
          setActiveSede(def);
          localStorage.setItem('alico_active_sede', def);
        }
        
        // Disparar evento para alertar a todos los componentes hijos que recarguen sus datos
        window.dispatchEvent(new Event('sedeChanged'));
      }
    });

    // Escuchadores globales de eventos de estado
    const handleSedeChange = () => {
      const currentSede = localStorage.getItem('alico_active_sede');
      if (currentSede) setActiveSede(currentSede);
    };

    const handleSyncComplete = () => {
      setSyncStatus('synced');
    };

    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('supabase_synced', handleSyncComplete);

    return () => {
      window.removeEventListener('sedeChanged', handleSedeChange);
      window.removeEventListener('supabase_synced', handleSyncComplete);
    };
  }, [router]);

  const handleSedeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActiveSede(val);
    localStorage.setItem('alico_active_sede', val);
    // Disparar evento para alertar a todos los componentes hijos
    window.dispatchEvent(new Event('sedeChanged'));
  };

  const handleLogout = () => {
    localStorage.removeItem('alico_session');
    localStorage.removeItem('alico_active_sede');
    router.replace('/login');
  };

  const navItems = [
    {
      nombre: 'Resumen General',
      path: '/dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      )
    },
    {
      nombre: 'Ventas en Barra (POS)',
      path: '/dashboard/ventas',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      )
    },
    {
      nombre: 'Control de Mesas',
      path: '/dashboard/mesas',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      )
    },
    {
      nombre: 'Inventario de Sede',
      path: '/dashboard/inventario',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      )
    },
    {
      nombre: 'Cartera & Envases',
      path: '/dashboard/cartera',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879-.659c1.546-1.16 3.696-1.16 5.242 0l.879.659M8.25 9.75h7.5m-7.5 3h7.5M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      )
    },
    {
      nombre: 'Cierre de Caja',
      path: '/dashboard/cierre',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )
    },
    {
      nombre: 'Auditoría de Eventos',
      path: '/dashboard/auditoria',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      nombre: 'Gestión de Personal',
      path: '/dashboard/usuarios',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      )
    },
    {
      nombre: 'Configuración',
      path: '/dashboard/configuracion',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.59 4.59A2 2 0 1111 8H2.83a1 1 0 00-.7.29l-1 1a1 1 0 000 1.42l1 1a1 1 0 00.7.29H11a2 2 0 11-1.41 3.41l-.29-.29a1 1 0 00-1.42 0l-1 1a1 1 0 000 1.42l1 1a1 1 0 001.42 0l.29-.29A2 2 0 1114 11V2.83a1 1 0 00-.29-.7l-1-1a1 1 0 00-1.42 0l-1 1a1 1 0 000 1.42l.29.29zM17 11h2.17a1 1 0 00.7-.29l1-1a1 1 0 000-1.42l-1-1a1 1 0 00-.7-.29H17v4z" />
        </svg>
      )
    }
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (userRole === 'mesero') {
      return item.path === '/dashboard/mesas';
    }
    if (userRole === 'vendedor') {
      return item.path === '/dashboard/ventas' || item.path === '/dashboard/mesas';
    }
    return true;
  });

  if (planExpired) {
    return (
      <div className="min-h-screen bg-[#020205] text-zinc-100 flex items-center justify-center p-6">
        <div className="glass-card border border-red-500/20 shadow-2xl shadow-red-500/5 rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden bg-[#06060c]/95">
          <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none bg-red-500"></div>
          
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center border bg-red-500/10 text-red-400 border-red-500/20 shadow-lg shadow-red-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-8 h-8 animate-pulse">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-black text-white mb-3">Acceso Suspendido</h2>
          
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            La suscripción al plan de <strong>{negocioInfo?.plan_activo || 'SaaS'}</strong> de <strong>{negocioInfo?.nombre || 'tu negocio'}</strong> ha expirado o se encuentra suspendida.
          </p>

          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Negocio ID:</span>
              <span className="font-mono text-zinc-300 font-bold">{negocioInfo?.id}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Vencimiento del Plan:</span>
              <span className="text-red-400 font-bold">{negocioInfo?.fecha_vencimiento || 'Vencido'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Estado:</span>
              <span className="text-red-400 font-bold">SUSPENDIDO / EXPIRADO</span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 mb-6">
            Comunícate con el Super Administrador del sistema para renovar tu membresía y restaurar tu servicio.
          </p>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/20 hover:bg-red-900/30 border border-red-500/15 text-xs font-bold text-red-300 transition-all cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#020205] text-zinc-100">
      {/* 1. SIDEBAR (Eritorio) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 glass-panel border-r border-white/5 z-20">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto px-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 shadow-md shadow-amber-500/10 ring-1 ring-white/10 flex-shrink-0">
              <span className="text-sm font-bold text-black">N</span>
            </div>
            <div>
              <span className="text-md font-bold tracking-wider text-white">NEXUS SAAS</span>
              <p className="text-[9px] text-zinc-500 font-semibold tracking-widest uppercase text-left">Admin Room</p>
              
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center gap-1.5">
                  {syncStatus === 'demo' ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                      <span className="w-1 h-1 mr-1 rounded-full bg-amber-400 animate-pulse" />
                      Modo Demo (Local)
                    </span>
                  ) : !isOnline ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm" title="Sin conexión a internet. Guardando todo localmente.">
                      <span className="w-1 h-1 mr-1 rounded-full bg-amber-400 animate-pulse" />
                      Offline {pendingCount > 0 && `(${pendingCount} pend.)`}
                    </span>
                  ) : isSyncing || pendingCount > 0 ? (
                    <button 
                      onClick={forceSync}
                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm cursor-pointer hover:bg-blue-500/20 transition-all"
                      title="Hay cambios locales pendientes. Haz clic para forzar sincronización ahora."
                    >
                      <span className="w-1 h-1 mr-1 rounded-full bg-blue-400 animate-pulse animate-bounce" />
                      Sincronizando... ({pendingCount})
                    </button>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm" title="Todo sincronizado en la nube.">
                      <span className="w-1 h-1 mr-1 rounded-full bg-emerald-400" />
                      Producción Cloud
                    </span>
                  )}
                </div>
                {syncError && (
                  <div className="p-2 bg-red-950/20 border border-red-500/20 text-red-400 rounded-lg text-[9px] font-semibold leading-normal max-w-[220px]">
                    <p className="font-extrabold text-red-300">Error en {syncError.tabla} ({syncError.tipo_operacion}):</p>
                    <p className="mt-0.5 text-[8.5px] opacity-90 break-words">{syncError.message} (Cód: {syncError.code})</p>
                  </div>
                )}
                {dbError && (
                  <div className="p-2 bg-red-950/20 border border-red-500/20 text-red-300 rounded-lg text-[9px] font-semibold leading-normal max-w-[220px]">
                    <p className="font-extrabold text-red-200">Error DB Local ({dbError.tabla}):</p>
                    <p className="mt-0.5 text-[8.5px] opacity-90 break-words">{dbError.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sede Switcher Panel */}
          <div className="mb-6 px-2 py-3 bg-black/40 rounded-xl border border-white/5">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 px-1">
              Sede Activa
            </label>
            <select
              value={activeSede}
              onChange={handleSedeChange}
              className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center px-3 py-2.5 text-xs font-semibold rounded-xl transition-all gap-3 ${
                    isActive
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                  <span>{item.nombre}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer User Profile & Logout */}
          <div className="pt-4 border-t border-white/5 px-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <span className="text-[10px] font-bold text-emerald-400">DA</span>
              </div>
              <div className="truncate">
                <p className="text-[11px] font-semibold text-white truncate">{userName}</p>
                <p className="text-[9px] text-zinc-500 truncate font-mono uppercase tracking-wider text-[8px]">
                  {userRole === 'admin' ? 'Administrador' : userRole === 'vendedor' ? 'Vendedor POS' : 'Mesero'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/20 hover:bg-red-900/30 border border-red-500/15 text-[10px] font-bold text-red-300 transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Cerrar Sesión
            </button>
          </div>

        </div>
      </aside>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="flex flex-col flex-1 md:pl-64">
        
        {/* MOBILE TOP BAR */}
        <header className="flex items-center justify-between h-14 md:hidden glass-panel border-b border-white/5 px-4 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-amber-500 flex items-center justify-center text-black font-bold text-xs flex-shrink-0">
              N
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wider text-white">NEXUS SAAS</span>
              <span 
                className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'demo' ? 'bg-amber-400 animate-pulse' : !isOnline ? 'bg-amber-400 animate-pulse' : isSyncing || pendingCount > 0 ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} 
                title={syncStatus === 'demo' ? 'Modo Demo (Local)' : !isOnline ? `Offline (${pendingCount} pendientes)` : isSyncing || pendingCount > 0 ? `Sincronizando (${pendingCount} pendientes)` : 'Producción Cloud Sincronizado'}
              />
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </header>

        {/* MOBILE DRAWER DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/80 z-30 md:hidden animate-fade-in" onClick={() => setMobileMenuOpen(false)}>
            <div 
              className="w-64 max-w-[80vw] h-full glass-panel border-r border-white/5 flex flex-col p-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Sede Switcher */}
              <div className="mb-6 px-1">
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Sede Activa
                </label>
                <select
                  value={activeSede}
                  onChange={handleSedeChange}
                  className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Navigation Links */}
              <nav className="flex-grow space-y-1">
                {filteredNavItems.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2 text-xs font-semibold rounded-xl gap-3 transition-all ${
                        isActive
                          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.icon}
                      <span>{item.nombre}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile Profile & Logout */}
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 mb-4 px-1">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                    DA
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{userName}</p>
                    <p className="text-[10px] text-zinc-500">Gerente de Sede</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/20 hover:bg-red-900/30 border border-red-500/15 text-xs font-bold text-red-300 transition-all cursor-pointer"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-4">
          {expiryDaysLeft !== null && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-fade-in relative overflow-hidden">
              <div className="flex items-center gap-2.5">
                <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/15 text-amber-400 text-[10px]">
                  ⚠️
                </span>
                <p className="leading-relaxed">
                  <strong>¡Aviso de Suscripción!</strong> Tu plan de <strong>{negocioInfo?.plan_activo || 'SaaS'}</strong> vencerá en <strong>{expiryDaysLeft} {expiryDaysLeft === 1 ? 'día' : 'días'}</strong> ({negocioInfo?.fecha_vencimiento}). Comunícate con el administrador para renovar.
                </p>
              </div>
            </div>
          )}
          {localDbReady ? (
            children
          ) : (
            <div className="flex h-full w-full items-center justify-center min-h-[300px]">
              <div className="flex flex-col items-center gap-4 text-center animate-pulse">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500"></div>
                <p className="text-xs font-semibold tracking-wide text-zinc-500">
                  Cargando base de datos local offline...
                </p>
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
