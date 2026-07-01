'use client';

import { useState, useEffect } from 'react';
import { mockDb, AuditLog } from '@/lib/supabaseClient';

export default function AuditoriaPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('TODAS');
  
  const loadLogs = () => {
    const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
    setActiveSedeId(currentSedeId);
    // Cargar los logs y ordenarlos del más reciente al más antiguo
    const allLogs = mockDb.getAuditLogs(currentSedeId);
    const sorted = [...allLogs].sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime());
    setLogs(sorted);
  };

  useEffect(() => {
    loadLogs();

    const handleSedeChange = () => {
      loadLogs();
    };

    const handleCloudSync = () => {
      loadLogs();
    };

    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);

    return () => {
      window.removeEventListener('sedeChanged', handleSedeChange);
      window.removeEventListener('cloudSync', handleCloudSync);
    };
  }, []);

  // Filtrado de Logs
  const logsFiltrados = logs.filter(log => {
    const matchesSearch = log.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
                          log.detalle.toLowerCase().includes(busqueda.toLowerCase()) ||
                          log.accion.toLowerCase().includes(busqueda.toLowerCase());
    
    const matchesAccion = filtroAccion === 'TODAS' || log.accion === filtroAccion;
    return matchesSearch && matchesAccion;
  });

  // Métricas
  const totalLogs = logs.length;
  const prodDeletes = logs.filter(l => l.accion === 'ELIMINAR_PRODUCTO').length;
  const salesAnnulled = logs.filter(l => l.accion === 'ANULAR_VENTA').length;
  const historyClears = logs.filter(l => l.accion.startsWith('LIMPIAR_')).length;

  // Obtener estilo de insignia por acción
  const getActionBadgeStyle = (accion: string) => {
    switch (accion) {
      case 'ELIMINAR_PRODUCTO':
        return 'bg-red-500/10 border-red-500/25 text-red-400';
      case 'ELIMINAR_INSUMO':
        return 'bg-rose-500/10 border-rose-500/25 text-rose-400';
      case 'ELIMINAR_PRESTAMO':
        return 'bg-amber-500/10 border-amber-500/25 text-amber-400';
      case 'ANULAR_VENTA':
        return 'bg-purple-500/10 border-purple-500/25 text-purple-400';
      case 'LIMPIAR_PRESTAMOS_DEVUELTOS':
      case 'LIMPIAR_CREDITOS_PAGADOS':
        return 'bg-blue-500/10 border-blue-500/25 text-blue-400';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6 text-amber-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Auditoría de Eventos
          </h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Historial de seguridad y bitácora de acciones críticas de los administradores.
          </p>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-[3px] bg-zinc-500"></div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Eventos Registrados</p>
          <h2 className="text-2xl font-black text-white mt-2 font-sans">{totalLogs}</h2>
          <p className="text-[9px] text-zinc-400 mt-1 font-medium">Logs almacenados en esta sede.</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-[3px] bg-red-500"></div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Productos Eliminados</p>
          <h2 className="text-2xl font-black text-red-400 mt-2 font-sans">{prodDeletes}</h2>
          <p className="text-[9px] text-zinc-400 mt-1 font-medium">Bajas de catálogo registradas.</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-[3px] bg-purple-500"></div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ventas Anuladas</p>
          <h2 className="text-2xl font-black text-purple-400 mt-2 font-sans">{salesAnnulled}</h2>
          <p className="text-[9px] text-zinc-400 mt-1 font-medium">Reintegros de stock por anulación.</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-[3px] bg-blue-500"></div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Historiles Limpiados</p>
          <h2 className="text-2xl font-black text-blue-400 mt-2 font-sans">{historyClears}</h2>
          <p className="text-[9px] text-zinc-400 mt-1 font-medium">Vaciados de préstamos o deudas.</p>
        </div>
      </div>

      {/* Buscador & Selector de Tipo de Acción */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Buscador */}
        <div className="md:col-span-2 relative w-full">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por usuario, acción o detalle..."
            className="w-full h-10 pl-10 pr-4 rounded-xl glass-input text-xs text-white"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
            </svg>
          </div>
        </div>

        {/* Filtro de Tipo de Acción */}
        <div>
          <select
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#0a0a0c] border border-white/10 text-xs text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="TODAS">Filtro Acción: Todas</option>
            <option value="ELIMINAR_PRODUCTO">Eliminación de Productos</option>
            <option value="ELIMINAR_INSUMO">Eliminación de Insumos</option>
            <option value="ELIMINAR_PRESTAMO">Eliminación de Préstamos</option>
            <option value="ANULAR_VENTA">Anulación de Ventas</option>
            <option value="LIMPIAR_PRESTAMOS_DEVUELTOS">Limpieza de Envases Devueltos</option>
            <option value="LIMPIAR_CREDITOS_PAGADOS">Limpieza de Cuentas Pagadas</option>
          </select>
        </div>
      </div>

      {/* Bitácora de Eventos - Estilo Timeline Glassmórfica */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Eventos de la Sede Activa</h3>
          <span className="text-[10px] font-semibold text-zinc-500">{logsFiltrados.length} registros</span>
        </div>

        <div className="p-6 max-h-[500px] overflow-y-auto scrollbar-thin space-y-6">
          {logsFiltrados.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 font-semibold">
              No se han encontrado registros en la bitácora con los filtros aplicados.
            </div>
          ) : (
            <div className="relative border-l border-zinc-800 ml-4 pl-6 space-y-6">
              {logsFiltrados.map((log) => (
                <div key={log.id} className="relative group">
                  {/* Nodo circular del timeline */}
                  <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center group-hover:border-amber-500 transition-all">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 group-hover:bg-amber-500"></span>
                  </span>

                  <div className="glass-card rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8.5px] font-black uppercase border ${getActionBadgeStyle(log.accion)}`}>
                          {log.accion.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-extrabold text-white">
                          Realizado por: <strong className="text-amber-500">{log.usuario}</strong>
                        </span>
                      </div>
                      
                      <span className="text-[10px] text-zinc-500 font-bold">
                        {new Date(log.fecha_hora).toLocaleString('es-CO')}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 font-semibold leading-relaxed">
                      {log.detalle}
                    </p>

                    <div className="text-[9px] text-zinc-600 font-mono">
                      Log ID: {log.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerta informativa sobre la base de datos remota */}
      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-zinc-400 space-y-1.5">
        <p className="font-bold text-amber-500">🛡️ Nota de Seguridad e Infraestructura:</p>
        <p className="font-semibold text-[11px] leading-relaxed">
          Las acciones registradas aquí se guardan localmente para garantizar el funcionamiento sin conexión y se sincronizan automáticamente con la nube si la tabla <code>auditoria</code> existe en Supabase. Si eres Super Administrador, recuerda ejecutar el script de creación de tabla en la consola SQL de tu Supabase.
        </p>
      </div>
    </div>
  );
}
