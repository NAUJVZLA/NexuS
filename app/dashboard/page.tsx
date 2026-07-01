'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { mockDb, Producto, Mesa, Venta, CierreCaja } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [activeSedeNombre, setActiveSedeNombre] = useState('Cargando sede...');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  const loadSedeData = () => {
    const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
    setActiveSedeId(currentSedeId);

    // Cargar nombre de la sede filtrando por negocio
    const sessionStr = localStorage.getItem('alico_session');
    let negocioId: string | undefined;
    if (sessionStr) {
      try {
        negocioId = JSON.parse(sessionStr).negocio_id;
      } catch (e) {}
    }

    const sedes = mockDb.getSedes(negocioId);
    const currentSede = sedes.find(s => s.id === currentSedeId);
    if (currentSede) {
      setActiveSedeNombre(currentSede.nombre);
    }

    // Cargar entidades
    setProductos(mockDb.getProductos(currentSedeId));
    setMesas(mockDb.getMesas(currentSedeId));
    setVentas(mockDb.getVentas(currentSedeId));
    setCierres(mockDb.getCierres(currentSedeId));
  };

  useEffect(() => {
    loadSedeData();

    // Sincronizar reactivamente al cambiar de sede
    const handleSedeChange = () => {
      loadSedeData();
    };
    const handleCloudSync = () => { loadSedeData(); };
    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);
    return () => { window.removeEventListener('sedeChanged', handleSedeChange); window.removeEventListener('cloudSync', handleCloudSync); };
  }, []);

  // Cálculos estadísticos rápidos
  // 1. Total ventas acumuladas (excluyendo anuladas)
  const totalVentasValor = ventas.filter(v => v.estado !== 'ANULADA').reduce((sum, v) => sum + v.total, 0);

  // 2. Ventas del día de hoy (excluyendo anuladas)
  const todayStr = new Date().toDateString();
  const ventasHoy = ventas.filter(v => {
    const fechaVenta = new Date(v.fecha_hora);
    return fechaVenta.toDateString() === todayStr && v.estado !== 'ANULADA';
  });
  const totalVentasHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);

  // 3. Ventas del turno activo (desde el último cierre de caja, excluyendo anuladas)
  const ultimoCierre = cierres.length > 0 ? cierres[0] : null;
  const ventasTurno = ventas.filter(v => {
    if (v.estado === 'ANULADA') return false;
    if (!ultimoCierre) return true;
    return new Date(v.fecha_hora) > new Date(ultimoCierre.fecha_hora);
  });
  const totalVentasTurno = ventasTurno.reduce((sum, v) => sum + v.total, 0);

  const totalProductos = productos.length;
  const mesasOcupadas = mesas.filter(m => m.estado === 'OCUPADA' || m.estado === 'PAGANDO').length;
  
  // Alertas de Stock Crítico
  const stockCriticos = productos.filter(p => p.stock_actual <= p.stock_minimo);

  // Valor total del inventario en bodega (costo y venta potencial)
  const valorInventarioCompra = productos.reduce((sum, p) => sum + (p.precio_compra * p.stock_actual), 0);
  const valorInventarioVenta = productos.reduce((sum, p) => sum + (p.precio_venta * p.stock_actual), 0);
  const gananciaEstimada = valorInventarioVenta - valorInventarioCompra;

  // Lista de mesas que tienen consumos activos
  const mesasActivasConsumo = mesas.filter(m => m.estado !== 'DISPONIBLE');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Resumen General</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Visualizando métricas operativas de: <span className="text-amber-500">{activeSedeNombre}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/ventas"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl shadow-lg shadow-amber-500/10 flex items-center gap-1.5 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Nueva Venta POS
          </Link>
        </div>
      </div>

      {/* Grid de Kpis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between">
          <div>
            <Link
              href="/dashboard/ventas?tab=HISTORIAL&group=day"
              className="absolute top-0 right-0 p-3 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-bl-xl border-l border-b border-white/5 transition-all cursor-pointer z-10"
              title="Ver Historial de Ventas por Día"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.214.113a3.13 3.13 0 003.717-1.36L15 15M9 6.75V15m6-6.75V15" />
              </svg>
            </Link>
            <Link href="/dashboard/ventas?tab=HISTORIAL&group=day" className="group block cursor-pointer">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">Ventas del Turno (Caja Activa)</p>
              <p className="text-2xl font-black text-white mt-2 group-hover:scale-[1.02] transition-transform origin-left">
                ${totalVentasTurno.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] font-semibold text-emerald-400 mt-2 block">
                +{ventasTurno.length} transacciones en turno
              </span>
            </Link>

            <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
              <div className="flex justify-between items-center text-[10px] text-zinc-400">
                <span className="font-medium">Ventas de Hoy (Día):</span>
                <span className="font-bold text-zinc-300">${totalVentasHoy.toLocaleString('es-CO')}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/ventas?tab=HISTORIAL&group=day"
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 text-[9px] font-black text-zinc-300 hover:text-white transition-all text-center"
            >
              Ver Ventas por Día
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.63l-3-3a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06l3-3H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              href="/dashboard/inventario?tab=movimientos"
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 text-[9px] font-black text-zinc-300 hover:text-white transition-all text-center"
            >
              Ver Entradas/Salidas
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.63l-3-3a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06l3-3H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-amber-500 bg-amber-500/5 rounded-bl-xl border-l border-b border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3-1.091" />
            </svg>
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Mesas en Consumo</p>
          <p className="text-2xl font-black text-white mt-2">
            {mesasOcupadas} / {mesas.length}
          </p>
          <span className="text-[10px] font-semibold text-zinc-400 mt-2 block">
            {mesas.filter(m => m.estado === 'DISPONIBLE').length} libres para asignar
          </span>
        </div>

        {/* KPI 3 */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-cyan-500 bg-cyan-500/5 rounded-bl-xl border-l border-b border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
            </svg>
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Productos en Catálogo</p>
          <p className="text-2xl font-black text-white mt-2">
            {totalProductos} Referencias
          </p>
          <span className="text-[10px] font-semibold text-zinc-400 mt-2 block">
            Surtido actual de la sede
          </span>
        </div>

        {/* KPI 4 */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-indigo-500 bg-indigo-500/5 rounded-bl-xl border-l border-b border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125-.504 1.125-1.125V3.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125H6.75m0 0V21m3-18v18m0 0h6.375c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H16.5" />
            </svg>
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Valoración Bodega</p>
          <p className="text-2xl font-black text-white mt-2">
            ${valorInventarioVenta.toLocaleString('es-CO')}
          </p>
          <span className="text-[10px] font-semibold text-amber-400 mt-2 block">
            Ganancia est. +${gananciaEstimada.toLocaleString('es-CO')}
          </span>
        </div>
      </div>

      {/* Grid de Secciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Alertas de Stock Crítico */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col flex-1">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></span>
                Alertas de Stock Crítico
              </h3>
              <span className="text-[10px] font-bold bg-red-950/40 border border-red-500/20 text-red-400 py-0.5 px-2 rounded-md">
                {stockCriticos.length} Alertas
              </span>
            </div>

            {stockCriticos.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <div className="h-10 w-10 rounded-full bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-zinc-300">¡Inventario Excelente!</p>
                <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px]">Ningún producto se encuentra por debajo de su cantidad de stock mínimo.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {stockCriticos.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-red-950/10 hover:bg-red-950/20 border border-red-500/10 hover:border-red-500/25 rounded-xl flex items-center justify-between transition-all"
                  >
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[150px]">{p.nombre}</p>
                      <p className="text-[9px] text-zinc-400 mt-0.5">{p.categoria}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-red-400">
                        {p.stock_actual} U.
                      </p>
                      <p className="text-[8px] text-zinc-500 mt-0.5">mínimo: {p.stock_minimo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-white/5">
              <Link
                href="/dashboard/inventario"
                className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 text-[10px] font-bold text-zinc-400 hover:text-white transition-all"
              >
                Gestionar Bodega
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.63l-3-3a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06l3-3H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Columna Derecha (2 spans): Mesas en Consumo Activo */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col flex-1">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-amber-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292" />
                </svg>
                Mesas con Consumo Activo
              </h3>
              <span className="text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 py-0.5 px-2 rounded-md">
                {mesasActivasConsumo.length} Ocupadas
              </span>
            </div>

            {mesasActivasConsumo.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-500/60 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-zinc-300">Sala Vacía</p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-[280px]">No hay clientes consumiendo en mesa actualmente. ¡Ideal para recibir nuevas comandas!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
                {mesasActivasConsumo.map((m) => {
                  const subtotalMesa = m.consumos.reduce((s, c) => s + (c.precio_unitario * c.cantidad), 0);
                  const isPaying = m.estado === 'PAGANDO';
                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPaying 
                          ? 'bg-yellow-950/15 border-yellow-500/20 hover:border-yellow-500/40 glow-amber' 
                          : 'bg-zinc-950/40 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg text-black ${
                            isPaying ? 'bg-yellow-500' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                          }`}>
                            {m.numero_mesa}
                          </span>
                          <span className="text-[10px] text-zinc-500 ml-2 font-medium">
                            {isPaying ? 'Pidiendo Cuenta' : 'En Consumo'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-white">
                          ${subtotalMesa.toLocaleString('es-CO')}
                        </p>
                      </div>

                      <div className="mt-3">
                        <p className="text-[10px] text-zinc-400 font-semibold truncate">
                          <span className="text-zinc-500">Cliente:</span> {m.cliente_nombre || 'Sin registrar'}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[9px] text-zinc-500 font-medium">
                          {m.consumos.length} items ordenados
                        </span>
                        <Link
                          href="/dashboard/mesas"
                          className={`text-[9px] font-bold py-1 px-2.5 rounded-md transition-all ${
                            isPaying 
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-black shadow-md' 
                              : 'bg-white/2 hover:bg-white/5 border border-white/10 text-zinc-300 hover:text-white'
                          }`}
                        >
                          {isPaying ? 'Cobrar Mesa' : 'Ver Detalle'}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/5">
              <Link
                href="/dashboard/mesas"
                className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 text-[10px] font-bold text-zinc-400 hover:text-white transition-all"
              >
                Ver Mapa Completo de Mesas
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.63l-3-3a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06l3-3H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
