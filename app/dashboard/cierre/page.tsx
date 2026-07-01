'use client';

import { useState, useEffect } from 'react';
import { mockDb, Venta, CierreCaja } from '@/lib/supabaseClient';

export default function CierreCajaPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [activeSedeNombre, setActiveSedeNombre] = useState('');
  const [cajeroName, setCajeroName] = useState('Administrador');
  const [ventasSede, setVentasSede] = useState<Venta[]>([]);
  const [ventasDiaHoy, setVentasDiaHoy] = useState<Venta[]>([]); // Ventas del día de hoy
  const [historicoCierres, setHistoricoCierres] = useState<CierreCaja[]>([]);
 
  // Inputs del Formulario
  const [baseApertura, setBaseApertura] = useState<number>(50000);
  const [efectivoReal, setEfectivoReal] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [selectedCierreImprimir, setSelectedCierreImprimir] = useState<CierreCaja | null>(null);
 
  // Cargar datos
  const loadCierreData = () => {
    const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
    setActiveSedeId(currentSedeId);
 
    // Cargar nombre de sede
    const sedes = mockDb.getSedes();
    const currentSede = sedes.find(s => s.id === currentSedeId);
    if (currentSede) {
      setActiveSedeNombre(currentSede.nombre);
    }
 
    // Cargar usuario activo
    const sessionStr = localStorage.getItem('alico_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setCajeroName(session.nombre || 'Administrador');
      } catch (e) { }
    }
 
    // Cargar cierres históricos
    const cierres = mockDb.getCierres(currentSedeId);
    setHistoricoCierres(cierres);
 
    // Cargar ventas de la sede
    const todasLasVentas = mockDb.getVentas(currentSedeId);
 
    // Cargar ventas del día de hoy (con fines informativos)
    const todayStr = new Date().toDateString();
    const ventasHoyFiltradas = todasLasVentas.filter(v => {
      return new Date(v.fecha_hora).toDateString() === todayStr && v.estado !== 'ANULADA';
    });
    setVentasDiaHoy(ventasHoyFiltradas);
 
    // FILTRAR VENTAS ACTIVAS: Solo aquellas hechas después del último cierre (excluyendo anuladas)
    if (cierres.length > 0) {
      const ultimoCierreFecha = new Date(cierres[0].fecha_hora);
      const ventasActivas = todasLasVentas.filter(v => {
        const fechaVenta = new Date(v.fecha_hora);
        return fechaVenta > ultimoCierreFecha && v.estado !== 'ANULADA';
      });
      setVentasSede(ventasActivas);
    } else {
      // Si nunca ha habido un cierre, tomamos todas las ventas registradas (excluyendo anuladas)
      setVentasSede(todasLasVentas.filter(v => v.estado !== 'ANULADA'));
    }
  };

  useEffect(() => {
    loadCierreData();

    const handleSedeChange = () => {
      loadCierreData();
    };
    const handleCloudSync = () => { loadCierreData(); };
    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);
    return () => { window.removeEventListener('sedeChanged', handleSedeChange); window.removeEventListener('cloudSync', handleCloudSync); };
  }, []);

  // Cálculos contables del turno activo
  const ventasEfectivo = ventasSede.filter(v => v.metodo_pago === 'EFECTIVO').reduce((sum, v) => sum + v.total, 0);
  const ventasTarjeta = ventasSede.filter(v => v.metodo_pago === 'TARJETA').reduce((sum, v) => sum + v.total, 0);
  const ventasTransferencia = ventasSede.filter(v => v.metodo_pago === 'TRANSFERENCIA').reduce((sum, v) => sum + v.total, 0);
  const ventasCredito = ventasSede.filter(v => v.metodo_pago === 'CREDITO').reduce((sum, v) => sum + v.total, 0);
  const totalVentasTurno = ventasSede.reduce((sum, v) => sum + v.total, 0);
  const totalVentasCantidad = ventasSede.length;

  // Cálculos contables del día de hoy
  const totalVentasDiaHoy = ventasDiaHoy.reduce((sum, v) => sum + v.total, 0);
  const totalVentasDiaHoyCount = ventasDiaHoy.length;

  // Efectivo Esperado en Caja = Base de Apertura + Ventas en Efectivo
  const efectivoEsperado = baseApertura + ventasEfectivo;

  // Calcular Descuadre en base al efectivo real digitado
  const efectivoRealNum = parseFloat(efectivoReal) || 0;
  const descuadre = efectivoReal === '' ? 0 : efectivoRealNum - efectivoEsperado;

  // Efectuar Cierre
  const handlePerformCierre = (e: React.FormEvent) => {
    e.preventDefault();

    if (efectivoReal === '') {
      alert('Por favor, ingresa el monto de efectivo real que contaste en caja.');
      return;
    }

    const confirmacion = window.confirm('¿Estás seguro de que deseas realizar el cierre de caja? Esto cerrará el turno actual.');
    if (!confirmacion) return;

    const nuevoCierre = mockDb.registrarCierre({
      sede_id: activeSedeId,
      monto_apertura: baseApertura,
      ventas_efectivo: ventasEfectivo,
      ventas_tarjeta: ventasTarjeta,
      ventas_transferencia: ventasTransferencia,
      ventas_credito: ventasCredito,
      ventas_total: totalVentasTurno,
      monto_real: efectivoRealNum,
      descuadre: descuadre,
      registrado_por: cajeroName,
      notas: notas,
      ventas_count: totalVentasCantidad
    });

    // Resetear formulario
    setEfectivoReal('');
    setNotas('');
    setSelectedCierreImprimir(nuevoCierre);

    // Recargar datos para que las ventas del turno vuelvan a cero
    loadCierreData();

    // Disparar evento para alertar
    window.dispatchEvent(new Event('sedeChanged'));
  };

  // Impresión de ticket térmico de cierre
  const printCierreReceipt = (cierre: CierreCaja) => {
    if (typeof window === 'undefined') return;

    const sedes = mockDb.getSedes();
    const currentSede = sedes.find(s => s.id === cierre.sede_id);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Habilita los popups para imprimir.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cierre de Caja - ${cierre.id}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 15px; color: #000; background-color: #fff; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 4px 0; }
            .footer { font-size: 9px; margin-top: 15px; text-align: center; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="background: #1e1e1e; color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-family: sans-serif; font-size: 12px; margin-bottom: 15px; border-radius: 4px;">
            <span>📄 Comprobante de Cierre</span>
            <div style="display: flex; gap: 8px;">
              <button onclick="window.print()" style="background: #e2a82b; border: none; padding: 4px 12px; font-weight: bold; border-radius: 4px; cursor: pointer; color: black;">Imprimir</button>
              <button onclick="window.close()" style="background: #374151; color: #d1d5db; border: 1px solid #4b5563; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer;">Cerrar Vista Previa</button>
            </div>
          </div>

          <div class="text-center">
            <h2 style="margin: 0; font-size: 13px; font-weight: bold;">${currentSede?.nombre || 'NEXUS'}</h2>
            ${currentSede?.rut ? `<p style="margin: 2px 0; font-size: 8px; font-family: monospace;">RUT: ${currentSede.rut}</p>` : ''}
            ${currentSede?.direccion ? `<p style="margin: 2px 0; font-size: 8px; font-family: monospace;">Dir: ${currentSede.direccion}</p>` : ''}
            <p style="margin: 3px 0; font-size: 9px; font-weight: bold; text-decoration: underline;">TICKET DE CIERRE DE CAJA (TURNO)</p>
          </div>
          
          <div class="divider"></div>
          
          <p style="margin: 3px 0;"><strong>ID Cierre:</strong> ${cierre.id}</p>
          <p style="margin: 3px 0;"><strong>Fecha/Hora:</strong> ${new Date(cierre.fecha_hora).toLocaleString('es-CO')}</p>
          <p style="margin: 3px 0;"><strong>Auditado Por:</strong> ${cierre.registrado_por}</p>
          
          <div class="divider"></div>
          
          <p class="bold" style="margin: 4px 0; text-decoration: underline;">AUDITORÍA DE CAJA:</p>
          <table>
            <tr><td>(+) Base de Apertura:</td><td style="text-align: right;">$${cierre.monto_apertura.toLocaleString('es-CO')}</td></tr>
            <tr><td>(+) Ventas en Efectivo:</td><td style="text-align: right;">$${cierre.ventas_efectivo.toLocaleString('es-CO')}</td></tr>
            <tr style="border-top: 1px solid #000; font-weight: bold;">
              <td>(=) Efectivo Esperado:</td>
              <td style="text-align: right;">$${(cierre.monto_apertura + cierre.ventas_efectivo).toLocaleString('es-CO')}</td>
            </tr>
            <tr><td>(x) Efectivo Real Contado:</td><td style="text-align: right; font-weight: bold;">$${cierre.monto_real.toLocaleString('es-CO')}</td></tr>
            <tr style="border-top: 1px dashed #000; font-weight: bold;">
              <td>(=) Descuadre:</td>
              <td style="text-align: right; color: ${cierre.descuadre < 0 ? 'red' : 'black'}">$${cierre.descuadre.toLocaleString('es-CO')}</td>
            </tr>
          </table>

          <div class="divider"></div>
          
          <p class="bold" style="margin: 4px 0; text-decoration: underline;">RESUMEN DE MEDIOS DE PAGO:</p>
          <table>
            <tr><td>💵 Ventas Efectivo:</td><td style="text-align: right;">$${cierre.ventas_efectivo.toLocaleString('es-CO')}</td></tr>
            <tr><td>💳 Ventas Tarjeta:</td><td style="text-align: right;">$${cierre.ventas_tarjeta.toLocaleString('es-CO')}</td></tr>
            <tr><td>📱 Ventas Transferencia:</td><td style="text-align: right;">$${cierre.ventas_transferencia.toLocaleString('es-CO')}</td></tr>
            <tr><td>📝 Ventas a Crédito:</td><td style="text-align: right;">$${cierre.ventas_credito.toLocaleString('es-CO')}</td></tr>
            <tr style="border-top: 1px solid #000; font-weight: bold;">
              <td>Total Ventas del Turno:</td>
              <td style="text-align: right;">$${cierre.ventas_total.toLocaleString('es-CO')}</td>
            </tr>
            <tr><td>Total Facturas Procesadas:</td><td style="text-align: right;">${cierre.ventas_count} trans.</td></tr>
          </table>

          ${cierre.notas ? `
            <div class="divider"></div>
            <p><strong>Observaciones:</strong></p>
            <p style="font-style: italic; white-space: pre-wrap;">${cierre.notas}</p>
          ` : ''}

          <div class="divider"></div>
          
          <div class="footer">
            <p style="margin: 0; font-weight: bold;">CIERRE DE TURNO OFICIAL</p>
            <p style="margin: 3px 0 0 0; font-size: 7.5px;">NexuS Gastro Bar POS • Control Multisede</p>
          </div>
          
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 400);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Cierre de Caja Diario</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Realiza la auditoría de caja para la sede: <span className="text-amber-500">{activeSedeNombre}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold bg-[#07130e] border border-emerald-500/20 text-emerald-400 py-1 px-3 rounded-lg flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Cajero Activo: {cajeroName}
          </span>
        </div>
      </div>

      {/* Grid Central */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna Izquierda (2 spans): Resumen del Turno & Formulario de Cierre */}
        <div className="lg:col-span-2 space-y-6">

          {/* Tarjeta de Resumen del Turno Activo */}
          <div className="glass-card rounded-2xl p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-5 flex items-center justify-between">
              <span>Auditoría del Turno Activo</span>
              <span className="text-[10px] text-zinc-500 normal-case font-semibold">
                (Transacciones acumuladas desde el último cierre)
              </span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Ventas Efectivo 💵</p>
                <p className="text-lg font-black text-white mt-1">${ventasEfectivo.toLocaleString('es-CO')}</p>
              </div>

              <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Ventas Tarjeta 💳</p>
                <p className="text-lg font-black text-white mt-1">${ventasTarjeta.toLocaleString('es-CO')}</p>
              </div>

              <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Transferencia 📱</p>
                <p className="text-lg font-black text-white mt-1">${ventasTransferencia.toLocaleString('es-CO')}</p>
              </div>

              <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">A Crédito 📝</p>
                <p className="text-lg font-black text-zinc-400 mt-1">${ventasCredito.toLocaleString('es-CO')}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Ventas del Turno Activo</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Monto de la caja del turno actual</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-500">${totalVentasTurno.toLocaleString('es-CO')}</p>
                  <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">{totalVentasCantidad} transacciones</p>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Ventas Totales de Hoy</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Acumulado general del día de hoy</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-400">${totalVentasDiaHoy.toLocaleString('es-CO')}</p>
                  <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">{totalVentasDiaHoyCount} transacciones</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario de Cierre Físico */}
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-5">
              Formulario de Arqueo y Cierre
            </h3>

            <form onSubmit={handlePerformCierre} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                {/* Base de Apertura */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    Base de Caja / Apertura ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-zinc-500 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={baseApertura}
                      onChange={(e) => setBaseApertura(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="Monto de la base de caja"
                      className="w-full h-10 pl-8 pr-4 rounded-xl glass-input text-xs text-white"
                    />
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1.5">
                    Dinero base dejado en el cajón monedero para dar cambio.
                  </p>
                </div>

                {/* Efectivo Real Contado */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                    <span>Efectivo Real en Caja ($)</span>
                    <span className="text-[9px] text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 font-bold">DIGITA AQUÍ</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-amber-500 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={efectivoReal}
                      onChange={(e) => setEfectivoReal(e.target.value)}
                      placeholder="Ej. 185000"
                      className="w-full h-10 pl-8 pr-4 rounded-xl glass-input border-amber-500/20 text-xs text-white focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1.5">
                    Cuenta físicamente los billetes y monedas que hay en tu caja e introduce el total.
                  </p>
                </div>

              </div>

              {/* Caja de Cálculos Contables Rápidos */}
              <div className="p-5 bg-black/50 border border-white/5 rounded-2xl space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-semibold">(=) Ventas en Efectivo:</span>
                  <span className="text-zinc-300 font-bold">${ventasEfectivo.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-semibold">(+) Base de Caja:</span>
                  <span className="text-zinc-300 font-bold">${baseApertura.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3">
                  <span className="text-white font-bold">(=) Efectivo Esperado en Caja:</span>
                  <span className="text-white font-black text-sm">${efectivoEsperado.toLocaleString('es-CO')}</span>
                </div>

                {/* Resultado del Descuadre */}
                {efectivoReal !== '' && (
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${descuadre === 0
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : descuadre < 0
                      ? 'bg-red-500/10 border-red-500/25 text-red-400'
                      : 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                    }`}>
                    <span>Diferencia (Descuadre):</span>
                    <span>
                      {descuadre === 0
                        ? '¡Perfecto! Caja Cuadrada ($0)'
                        : descuadre < 0
                          ? `Faltante: -$${Math.abs(descuadre).toLocaleString('es-CO')}`
                          : `Sobrante: +$${descuadre.toLocaleString('es-CO')}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Notas de Observación */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  Notas / Observaciones del Cierre
                </label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej. Faltaron $2,000 COP por devolución errónea en mesa 3 o sobraron propinas no retiradas..."
                  className="w-full p-4 rounded-xl glass-input text-xs text-white resize-none"
                />
              </div>

              {/* Botón de envío */}
              <button
                type="submit"
                className="w-full h-11 rounded-xl btn-gold font-bold text-sm shadow-xl shadow-amber-500/10 transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Efectuar Cierre de Caja del Turno
              </button>
            </form>
          </div>

        </div>

        {/* Columna Derecha (1 span): Historial de Cierres Pasados */}
        <div className="lg:col-span-1 space-y-6">

          {/* Último Cierre Generado (Acceso Rápido para Imprimir) */}
          {selectedCierreImprimir && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3.5 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                <span className="text-xs font-black text-amber-500 uppercase tracking-widest">Cierre Completado 🎉</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                El cierre de caja se registró con éxito en la base de datos local y se liberaron las ventas del turno.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => printCierreReceipt(selectedCierreImprimir)}
                  className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-black text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.82l2.6-2.6m0 0l2.6 2.6m-2.6-2.6v6.5m6-10.45a8.384 8.384 0 011.24 4.7c0 4.885-3.896 8.85-8.7 8.85-4.805 0-8.7-3.965-8.7-8.85 0-3.465 2.001-6.47 4.92-7.92M21 12H3" />
                  </svg>
                  Imprimir Ticket
                </button>
                <button
                  onClick={() => setSelectedCierreImprimir(null)}
                  className="h-9 px-3.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold rounded-lg border border-white/5"
                >
                  Entendido
                </button>
              </div>
            </div>
          )}

          {/* Historial de Cierres */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col flex-1">
            <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-4 flex items-center justify-between">
              <span>Historial de Cierres</span>
              <span className="text-[10px] font-bold bg-zinc-900 border border-white/5 text-zinc-400 py-0.5 px-2 rounded-md">
                {historicoCierres.length} Registros
              </span>
            </h3>

            {historicoCierres.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 font-semibold text-xs flex flex-col items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 mb-2 opacity-30 text-zinc-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.24h1.98a2.25 2.25 0 002.007-1.24l.885-1.77a2.25 2.25 0 012.007-1.24h3.86m-18 0h18" />
                </svg>
                No hay cierres previos grabados en esta sede.
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {historicoCierres.map((c) => {
                  const fecha = new Date(c.fecha_hora);
                  const fechaStr = fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' + fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl space-y-2 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[11px] font-bold text-white font-mono">{fechaStr}</p>
                          <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">Por: {c.registrado_por}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${c.descuadre === 0
                          ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-500/10'
                          : c.descuadre < 0
                            ? 'bg-red-950/20 text-red-400 border border-red-500/10'
                            : 'bg-blue-950/20 text-blue-400 border border-blue-500/10'
                          }`}>
                          {c.descuadre === 0
                            ? 'Cuadrado'
                            : c.descuadre < 0
                              ? `-$${Math.abs(c.descuadre).toLocaleString('es-CO')}`
                              : `+$${c.descuadre.toLocaleString('es-CO')}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-white/5">
                        <div>
                          <span className="text-zinc-500 block">Ventas Turno:</span>
                          <span className="text-zinc-300 font-bold">${c.ventas_total.toLocaleString('es-CO')}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Efectivo Real:</span>
                          <span className="text-zinc-300 font-bold">${c.monto_real.toLocaleString('es-CO')}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-between items-center gap-2">
                        <p className="text-[9px] text-zinc-500 truncate max-w-[130px]" title={c.notas || 'Sin notas'}>
                          {c.notas ? `✍️ ${c.notas}` : 'Sin observaciones'}
                        </p>
                        <button
                          onClick={() => printCierreReceipt(c)}
                          className="py-1 px-2.5 bg-white/2 hover:bg-white/5 border border-white/10 text-zinc-300 hover:text-white rounded-lg text-[9px] font-black transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-2.5 h-2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.82l2.6-2.6m0 0l2.6 2.6m-2.6-2.6v6.5" />
                          </svg>
                          Ticket
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
