'use client';

import { useState, useEffect } from 'react';
import { mockDb, CreditoCliente, PrestamoBotella, Producto, Venta } from '@/lib/supabaseClient';
import { printThermalReceipt } from '@/lib/printUtils';

export default function CarteraPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [creditos, setCreditos] = useState<CreditoCliente[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoBotella[]>([]);
  const [activeTab, setActiveTab] = useState<'cuentas' | 'prestamos'>('cuentas');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCuentas, setFiltroCuentas] = useState<'TODAS' | 'PENDIENTE' | 'PAGADO'>('TODAS');
  const [filtroPrestamos, setFiltroPrestamos] = useState<'TODOS' | 'PENDIENTE' | 'DEVUELTO'>('TODOS');

  // Modals state
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showVentaModal, setShowVentaModal] = useState(false);

  // Active items for modals
  const [selectedCredito, setSelectedCredito] = useState<CreditoCliente | null>(null);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);

  // Form inputs - Crédito Manual
  const [creditoClienteNombre, setCreditoClienteNombre] = useState('');
  const [creditoMonto, setCreditoMonto] = useState<number>(0);
  const [creditoAtendidoPor, setCreditoAtendidoPor] = useState('');
  const [creditoNotas, setCreditoNotas] = useState('');

  // Form inputs - Abono
  const [abonoMonto, setAbonoMonto] = useState<number>(0);

  // Form inputs - Préstamo Botellas
  const [prestamoClienteNombre, setPrestamoClienteNombre] = useState('');
  const [prestamoBotellaNombre, setPrestamoBotellaNombre] = useState('');
  const [prestamoCantidad, setPrestamoCantidad] = useState<number>(1);
  const [prestamoDescontarStock, setPrestamoDescontarStock] = useState(false);
  const [prestamoSelectedProdId, setPrestamoSelectedProdId] = useState('');
  const [prestamoAtendidoPor, setPrestamoAtendidoPor] = useState('');
  const [prestamoNotas, setPrestamoNotas] = useState('');

  // Devolución confirmación
  const [selectedPrestamo, setSelectedPrestamo] = useState<PrestamoBotella | null>(null);
  const [showDevolverModal, setShowDevolverModal] = useState(false);
  const [devolverReintegrarStock, setDevolverReintegrarStock] = useState(true);

  // General Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadSedeData = () => {
    const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
    setActiveSedeId(currentSedeId);
    setProductos(mockDb.getProductos(currentSedeId));
    setCreditos(mockDb.getCreditos(currentSedeId));
    setPrestamos(mockDb.getPrestamos(currentSedeId));
  };

  useEffect(() => {
    loadSedeData();

    const handleSedeChange = () => {
      loadSedeData();
      closeAllModals();
    };
    const handleCloudSync = () => { loadSedeData(); };
    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);
    return () => { window.removeEventListener('sedeChanged', handleSedeChange); window.removeEventListener('cloudSync', handleCloudSync); };
  }, []);

  const closeAllModals = () => {
    setShowAddCreditModal(false);
    setShowAbonoModal(false);
    setShowAddLoanModal(false);
    setShowDevolverModal(false);
    setShowVentaModal(false);
    setSelectedCredito(null);
    setSelectedPrestamo(null);
    setSelectedVenta(null);

    // Reset forms
    setCreditoClienteNombre('');
    setCreditoMonto(0);
    setCreditoAtendidoPor('');
    setCreditoNotas('');
    setAbonoMonto(0);

    setPrestamoClienteNombre('');
    setPrestamoBotellaNombre('');
    setPrestamoCantidad(1);
    setPrestamoDescontarStock(false);
    setPrestamoSelectedProdId('');
    setPrestamoAtendidoPor('');
    setPrestamoNotas('');

    setErrorMsg('');
    setSuccessMsg('');
  };

  // Cargar mesero predeterminado para agilizar formularios
  const openAddCredit = () => {
    const cachedWaiter = localStorage.getItem('alico_last_waiter') || '';
    setCreditoAtendidoPor(cachedWaiter);
    setShowAddCreditModal(true);
  };

  const openAddLoan = () => {
    const cachedWaiter = localStorage.getItem('alico_last_waiter') || '';
    setPrestamoAtendidoPor(cachedWaiter);
    setShowAddLoanModal(true);
  };

  const openAbono = (credito: CreditoCliente) => {
    setSelectedCredito(credito);
    setAbonoMonto(credito.total_deuda - credito.total_pagado);
    setShowAbonoModal(true);
  };

  const openDevolver = (prestamo: PrestamoBotella) => {
    setSelectedPrestamo(prestamo);
    setDevolverReintegrarStock(prestamo.descontó_stock);
    setShowDevolverModal(true);
  };

  // Visualizar factura vinculada al crédito
  const openVentaDetalle = (ventaId: string) => {
    const ventasList = mockDb.getVentas(activeSedeId);
    const sale = ventasList.find(v => v.id === ventaId);
    if (sale) {
      setSelectedVenta(sale);
      setShowVentaModal(true);
    } else {
      alert('La venta vinculada no pudo ser encontrada en el historial de esta sede.');
    }
  };

  // ==========================================
  // ACTIONS SUBMITS
  // ==========================================
  
  // Registrar crédito manual
  const submitAddCredit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!creditoClienteNombre.trim() || creditoMonto <= 0 || !creditoAtendidoPor.trim()) {
      setErrorMsg('Por favor rellena todos los campos requeridos y especifica un monto mayor a 0.');
      return;
    }

    try {
      mockDb.registrarCreditoManual({
        sede_id: activeSedeId,
        cliente_nombre: creditoClienteNombre,
        total_deuda: creditoMonto,
        registrado_por: creditoAtendidoPor,
        notas: creditoNotas
      });

      // Guardar atendido por para auditoría posterior
      localStorage.setItem('alico_last_waiter', creditoAtendidoPor);

      setSuccessMsg('Crédito manual registrado con éxito en la cartera.');
      loadSedeData();
      setTimeout(() => closeAllModals(), 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el crédito.');
    }
  };

  // Registrar abono a deuda
  const submitAbono = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedCredito) return;
    const maxAbono = selectedCredito.total_deuda - selectedCredito.total_pagado;
    
    if (abonoMonto <= 0) {
      setErrorMsg('El abono debe ser un monto mayor a cero.');
      return;
    }
    if (abonoMonto > maxAbono) {
      setErrorMsg(`El abono supera la deuda restante de $${maxAbono.toLocaleString('es-CO')}.`);
      return;
    }

    try {
      mockDb.registrarAbonoCredito(selectedCredito.id, abonoMonto);
      setSuccessMsg('Abono registrado con éxito en la cuenta del cliente.');
      loadSedeData();
      
      // Emitir cambio de sede global para actualizar dashboard
      window.dispatchEvent(new Event('sedeChanged'));

      setTimeout(() => closeAllModals(), 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el abono.');
    }
  };

  // Registrar préstamo de botellas
  const submitAddLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!prestamoClienteNombre.trim() || !prestamoBotellaNombre.trim() || prestamoCantidad <= 0 || !prestamoAtendidoPor.trim()) {
      setErrorMsg('Por favor rellena todos los campos del préstamo.');
      return;
    }

    try {
      mockDb.registrarPrestamo({
        sede_id: activeSedeId,
        cliente_nombre: prestamoClienteNombre,
        botella_nombre: prestamoBotellaNombre,
        cantidad: prestamoCantidad,
        registrado_por: prestamoAtendidoPor,
        descontó_stock: prestamoDescontarStock,
        descontarStock: prestamoDescontarStock,
        producto_id: prestamoSelectedProdId || undefined,
        notas: prestamoNotas
      });

      localStorage.setItem('alico_last_waiter', prestamoAtendidoPor);
      setSuccessMsg('Préstamo registrado exitosamente y stock de envases descontado.');
      loadSedeData();
      setTimeout(() => closeAllModals(), 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el préstamo de botellas.');
    }
  };

  // Confirmar devolución de botellas
  const submitDevolucion = () => {
    if (!selectedPrestamo) return;

    try {
      mockDb.devolverPrestamo(selectedPrestamo.id, devolverReintegrarStock);
      setSuccessMsg('Envases marcados como DEVUELTOS con éxito.');
      loadSedeData();
      setTimeout(() => closeAllModals(), 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la devolución.');
    }
  };

  // Sincronizar campo de nombre de botella al escoger producto de la sede
  const handleProductSelectChange = (prodId: string) => {
    setPrestamoSelectedProdId(prodId);
    if (!prodId) {
      setPrestamoBotellaNombre('');
      setPrestamoDescontarStock(false);
      return;
    }

    const prod = productos.find(p => p.id === prodId);
    if (prod) {
      setPrestamoBotellaNombre(prod.nombre);
      setPrestamoDescontarStock(true); // Default true si es producto real
    }
  };

  const handleLimpiarCreditosPagados = () => {
    const pagados = creditos.filter(c => c.estado === 'PAGADO');
    if (pagados.length === 0) {
      alert('No hay cuentas con estado "PAGADO" en el historial de esta sede para limpiar.');
      return;
    }

    if (!confirm('¿Deseas limpiar todas las cuentas cobradas/pagadas del historial? Las cuentas con saldo pendiente se mantendrán intactas.')) {
      return;
    }

    try {
      let sessionUser = 'Administrador';
      try {
        const sessionStr = localStorage.getItem('alico_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          sessionUser = session.nombre || 'Administrador';
        }
      } catch (e) {}

      mockDb.limpiarCreditosPagados(activeSedeId, sessionUser);
      setSuccessMsg('Historial de cuentas pagadas limpiado con éxito.');
      loadSedeData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al limpiar historial.');
    }
  };

  const handleLimpiarPrestamosDevueltos = () => {
    const devueltos = prestamos.filter(p => p.estado === 'DEVUELTO');
    if (devueltos.length === 0) {
      alert('No hay préstamos con estado "DEVUELTO" en el historial de esta sede para limpiar.');
      return;
    }

    if (!confirm('¿Deseas limpiar todos los envases marcados como DEVUELTOS del historial? Los préstamos pendientes se mantendrán intactas.')) {
      return;
    }

    try {
      let sessionUser = 'Administrador';
      try {
        const sessionStr = localStorage.getItem('alico_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          sessionUser = session.nombre || 'Administrador';
        }
      } catch (e) {}

      mockDb.limpiarPrestamosDevueltos(activeSedeId, sessionUser);
      setSuccessMsg('Historial de envases devueltos limpiado con éxito.');
      loadSedeData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al limpiar historial.');
    }
  };

  const handleEliminarPrestamo = (prestamoId: string, cliente: string, estado: string) => {
    const isPending = estado === 'PENDIENTE';
    const msg = isPending 
      ? `ATENCIÓN: El préstamo de ${cliente} está PENDIENTE. ¿Estás seguro de que deseas eliminarlo del historial sin registrar la devolución? Perderás el control de estas botellas.`
      : `¿Deseas eliminar este registro de préstamo del historial?`;

    if (!confirm(msg)) return;

    try {
      let sessionUser = 'Administrador';
      try {
        const sessionStr = localStorage.getItem('alico_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          sessionUser = session.nombre || 'Administrador';
        }
      } catch (e) {}

      mockDb.eliminarPrestamo(prestamoId, sessionUser);
      setSuccessMsg('Registro de préstamo eliminado del historial.');
      loadSedeData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar registro.');
    }
  };

  // ==========================================
  // METRICS & FILTERS CALCULATIONS
  // ==========================================
  
  // Filtrado general por búsqueda y filtro de estado
  const creditosFiltrados = creditos.filter(c => {
    const matchesSearch = c.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          (c.venta_id && c.venta_id.toLowerCase().includes(busqueda.toLowerCase()));
    const matchesStatus = filtroCuentas === 'TODAS' || c.estado === filtroCuentas;
    return matchesSearch && matchesStatus;
  });

  const prestamosFiltrados = prestamos.filter(p => {
    const matchesSearch = p.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          p.botella_nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchesStatus = filtroPrestamos === 'TODOS' || p.estado === filtroPrestamos;
    return matchesSearch && matchesStatus;
  });

  // Métricas Créditos
  const creditosPendientes = creditos.filter(c => c.estado === 'PENDIENTE');
  const totalCarteraActiva = creditosPendientes.reduce((sum, c) => sum + (c.total_deuda - c.total_pagado), 0);
  const deudoresActivosCount = new Set(creditosPendientes.map(c => c.cliente_nombre)).size;
  const totalCarteraRecuperada = creditos.reduce((sum, c) => sum + c.total_pagado, 0);

  // Métricas Envases
  const prestamosPendientes = prestamos.filter(p => p.estado === 'PENDIENTE');
  const totalEnvasesPrestados = prestamosPendientes.reduce((sum, p) => sum + p.cantidad, 0);
  const clientesEnvasesPendientes = new Set(prestamosPendientes.map(p => p.cliente_nombre)).size;
  const totalEnvasesDevueltos = prestamos.filter(p => p.estado === 'DEVUELTO').reduce((sum, p) => sum + p.cantidad, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Cartera & Envases</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Gestión de clientes fiaos, créditos otorgados y control de botellas prestadas.
          </p>
        </div>

        {/* Buttons Action */}
        <div className="flex gap-2 flex-wrap justify-end">
          {activeTab === 'cuentas' ? (
            <>
              <button
                onClick={handleLimpiarCreditosPagados}
                className="h-10 px-4 rounded-xl bg-red-950/20 border border-red-500/25 hover:bg-red-900/30 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-red-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Limpiar Pagados
              </button>
              <button
                onClick={openAddCredit}
                className="h-10 px-4 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Registrar Crédito Manual
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleLimpiarPrestamosDevueltos}
                className="h-10 px-4 rounded-xl bg-red-950/20 border border-red-500/25 hover:bg-red-900/30 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-red-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Limpiar Devueltos
              </button>
              <button
                onClick={openAddLoan}
                className="h-10 px-4 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Registrar Préstamo Envase
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs Selector & Buscador Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Tabs switcher */}
        <div className="md:col-span-2 flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5 max-w-sm">
          <button
            onClick={() => {
              setActiveTab('cuentas');
              setBusqueda('');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'cuentas'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Cuentas por Cobrar (Créditos)
          </button>
          <button
            onClick={() => {
              setActiveTab('prestamos');
              setBusqueda('');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'prestamos'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Préstamo de Botellas
          </button>
        </div>

        {/* Selector de Estado */}
        <div>
          {activeTab === 'cuentas' ? (
            <select
              value={filtroCuentas}
              onChange={(e: any) => setFiltroCuentas(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#0a0a0c] border border-white/10 text-xs text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="TODAS">Deudas: Todas</option>
              <option value="PENDIENTE">Deudas: Pendientes</option>
              <option value="PAGADO">Deudas: Pagadas</option>
            </select>
          ) : (
            <select
              value={filtroPrestamos}
              onChange={(e: any) => setFiltroPrestamos(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#0a0a0c] border border-white/10 text-xs text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="TODOS">Envases: Todos</option>
              <option value="PENDIENTE">Envases: Pendientes</option>
              <option value="DEVUELTO">Envases: Devueltos</option>
            </select>
          )}
        </div>

        {/* Buscador */}
        <div className="relative w-full">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente o detalle..."
            className="w-full h-10 pl-10 pr-4 rounded-xl glass-input text-xs text-white"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECCIÓN A: CUENTAS POR COBRAR TAB */}
      {/* ============================================================== */}
      {activeTab === 'cuentas' && (
        <div className="space-y-6">
          {/* KPIs Cuentas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500"></div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Cartera Pendiente Total</p>
              <h2 className="text-2xl font-black text-amber-500 mt-2 font-sans">
                ${totalCarteraActiva.toLocaleString('es-CO')}
              </h2>
              <p className="text-[9px] text-zinc-400 mt-1 font-medium">Cuentas fias por cobrar en esta sede.</p>
            </div>
            
            <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[3px] bg-red-500"></div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Deudores Activos</p>
              <h2 className="text-2xl font-black text-white mt-2 font-sans">
                {deudoresActivosCount} {deudoresActivosCount === 1 ? 'Cliente' : 'Clientes'}
              </h2>
              <p className="text-[9px] text-zinc-400 mt-1 font-medium">Personas registradas con saldo pendiente.</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[3px] bg-emerald-500"></div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Cartera Recuperada</p>
              <h2 className="text-2xl font-black text-emerald-400 mt-2 font-sans">
                ${totalCarteraRecuperada.toLocaleString('es-CO')}
              </h2>
              <p className="text-[9px] text-zinc-400 mt-1 font-medium">Monto acumulado cobrado con éxito.</p>
            </div>
          </div>

          {/* Tabla de Créditos */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Libro de Cuentas Fias</h3>
              <span className="text-[10px] font-semibold text-zinc-500">{creditosFiltrados.length} registros</span>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-black/10">
                    <th className="py-3 px-6">Cliente / Deudor</th>
                    <th className="py-3 px-6">Detalle / ID Venta</th>
                    <th className="py-3 px-6 text-right">Total Deuda</th>
                    <th className="py-3 px-6 text-right">Abonado</th>
                    <th className="py-3 px-6 text-right">Saldo Pendiente</th>
                    <th className="py-3 px-6">Fecha Registro</th>
                    <th className="py-3 px-6 text-center">Estado</th>
                    <th className="py-3 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {creditosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-zinc-500 font-semibold">
                        No hay deudas registradas que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    creditosFiltrados.map((cred) => {
                      const balance = cred.total_deuda - cred.total_pagado;
                      const isPaid = cred.estado === 'PAGADO';
                      return (
                        <tr key={cred.id} className="hover:bg-white/2 transition-colors">
                          <td className="py-3.5 px-6 font-bold text-xs text-white">
                            {cred.cliente_nombre}
                          </td>
                          <td className="py-3.5 px-6 text-xs text-zinc-400 font-semibold">
                            {cred.venta_id ? (
                              <button
                                onClick={() => openVentaDetalle(cred.venta_id!)}
                                className="text-amber-500 hover:text-amber-400 font-bold transition-all hover:underline"
                              >
                                Ver Venta #{cred.venta_id}
                              </button>
                            ) : (
                              <span className="italic text-zinc-500">Crédito Manual</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-xs text-zinc-300 text-right font-semibold">
                            ${Number(cred.total_deuda).toLocaleString('es-CO')}
                          </td>
                          <td className="py-3.5 px-6 text-xs text-emerald-400 text-right font-semibold">
                            ${Number(cred.total_pagado).toLocaleString('es-CO')}
                          </td>
                          <td className="py-3.5 px-6 text-xs text-amber-500 text-right font-black">
                            ${balance.toLocaleString('es-CO')}
                          </td>
                          <td className="py-3.5 px-6 text-[10px] text-zinc-500 font-bold">
                            {new Date(cred.fecha_registro).toLocaleString('es-CO')}
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              isPaid 
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse'
                            }`}>
                              {cred.estado}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isPaid && (
                                <button
                                  onClick={() => openAbono(cred)}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black font-black text-[10px] rounded transition-all cursor-pointer shadow shadow-amber-500/10"
                                >
                                  Abonar Cuenta
                                </button>
                              )}
                              {cred.notas && (
                                <span 
                                  title={cred.notas}
                                  className="text-zinc-500 cursor-help hover:text-zinc-300"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 122.871 5.07l-.305.102A.5.5 0 0010 11.5a.75.75 0 01-1.5 0v-.18a2 2 0 011.22-1.836l.305-.102a1.5 1.5 0 10-1.085-2.536.75.75 0 011.06 1.06zM11 15a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECCIÓN B: PRÉSTAMO DE BOTELLAS TAB */}
      {/* ============================================================== */}
      {activeTab === 'prestamos' && (
        <div className="space-y-6">
          {/* KPIs Prestamos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500"></div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Envases Prestados Activos</p>
              <h2 className="text-2xl font-black text-amber-500 mt-2 font-sans">
                {totalEnvasesPrestados} Botellas
              </h2>
              <p className="text-[9px] text-zinc-400 mt-1 font-medium">Unidades en préstamo pendientes de devolución.</p>
            </div>
            
            <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[3px] bg-red-500"></div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Clientes con Préstamos</p>
              <h2 className="text-2xl font-black text-white mt-2 font-sans">
                {clientesEnvasesPendientes} {clientesEnvasesPendientes === 1 ? 'Persona' : 'Personas'}
              </h2>
              <p className="text-[9px] text-zinc-400 mt-1 font-medium">Deudores activos de botellas físicas.</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[3px] bg-emerald-500"></div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Devoluciones Exitosas</p>
              <h2 className="text-2xl font-black text-emerald-400 mt-2 font-sans">
                {totalEnvasesDevueltos} Botellas
              </h2>
              <p className="text-[9px] text-zinc-400 mt-1 font-medium">Total de envases retornados físicamente.</p>
            </div>
          </div>

          {/* Tabla de Préstamos */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Registro de Envases Prestados</h3>
              <span className="text-[10px] font-semibold text-zinc-500">{prestamosFiltrados.length} registros</span>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-black/10">
                    <th className="py-3 px-6">Cliente / Receptor</th>
                    <th className="py-3 px-6">Detalle Envase / Botella</th>
                    <th className="py-3 px-6 text-center">Cantidad</th>
                    <th className="py-3 px-6 text-center">Descontó Stock</th>
                    <th className="py-3 px-6">Fecha Préstamo</th>
                    <th className="py-3 px-6">Fecha Devolución</th>
                    <th className="py-3 px-6 text-center">Estado</th>
                    <th className="py-3 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {prestamosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-zinc-500 font-semibold">
                        No hay registros de préstamos de botellas.
                      </td>
                    </tr>
                  ) : (
                    prestamosFiltrados.map((pr) => {
                      const isReturned = pr.estado === 'DEVUELTO';
                      return (
                        <tr key={pr.id} className="hover:bg-white/2 transition-colors">
                          <td className="py-3.5 px-6 font-bold text-xs text-white">
                            {pr.cliente_nombre}
                          </td>
                          <td className="py-3.5 px-6 text-xs text-zinc-300 font-semibold">
                            {pr.botella_nombre}
                          </td>
                          <td className="py-3.5 px-6 text-xs text-white text-center font-bold">
                            {pr.cantidad} {pr.cantidad === 1 ? 'u' : 'uds'}
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              pr.descontó_stock 
                                ? 'bg-orange-500/10 border border-orange-500/25 text-orange-400' 
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-500'
                            }`}>
                              {pr.descontó_stock ? 'Sí (Físico)' : 'No (Contenedor)'}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-[10px] text-zinc-400 font-semibold">
                            {new Date(pr.fecha_prestamo).toLocaleString('es-CO')}
                          </td>
                          <td className="py-3.5 px-6 text-[10px] text-zinc-500 font-bold">
                            {pr.fecha_devolucion ? (
                              new Date(pr.fecha_devolucion).toLocaleString('es-CO')
                            ) : (
                              <span className="italic text-zinc-600">Pendiente retorno</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              isReturned 
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse'
                            }`}>
                              {pr.estado}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isReturned && (
                                  <button
                                    onClick={() => openDevolver(pr)}
                                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-[10px] rounded transition-all cursor-pointer shadow shadow-emerald-500/10"
                                  >
                                    Devolver Envase
                                  </button>
                              )}
                              <button
                                onClick={() => handleEliminarPrestamo(pr.id, pr.cliente_nombre, pr.estado)}
                                title="Eliminar del historial"
                                className="p-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black hover:border-red-500 transition-all cursor-pointer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                              {pr.notas && (
                                <span 
                                  title={pr.notas}
                                  className="text-zinc-500 cursor-help hover:text-zinc-300"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 122.871 5.07l-.305.102A.5.5 0 0010 11.5a.75.75 0 01-1.5 0v-.18a2 2 0 011.22-1.836l.305-.102a1.5 1.5 0 10-1.085-2.536.75.75 0 011.06 1.06zM11 15a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: REGISTRAR CRÉDITO MANUAL */}
      {/* ============================================================== */}
      {showAddCreditModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              Registrar Crédito Manual
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-4">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
                {successMsg}
              </div>
            )}

            <form onSubmit={submitAddCredit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  value={creditoClienteNombre}
                  onChange={(e) => setCreditoClienteNombre(e.target.value)}
                  placeholder="Ej. Carlos Restrepo"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Monto de la Deuda ($ COP)
                </label>
                <input
                  type="number"
                  required
                  value={creditoMonto || ''}
                  onChange={(e) => setCreditoMonto(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Monto total adeudado"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Quién Otorga el Crédito
                </label>
                <input
                  type="text"
                  required
                  value={creditoAtendidoPor}
                  onChange={(e) => setCreditoAtendidoPor(e.target.value)}
                  placeholder="Nombre del mesero/auditor"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Notas de Deuda (Opcional)
                </label>
                <textarea
                  value={creditoNotas}
                  onChange={(e) => setCreditoNotas(e.target.value)}
                  placeholder="Ej. Quedó de pagar el próximo viernes en barra..."
                  className="w-full h-16 p-2.5 rounded-lg glass-input text-xs text-white resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAllModals}
                  className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold transition-all cursor-pointer"
                >
                  Registrar Crédito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: REGISTRAR ABONO / LIQUIDAR */}
      {/* ============================================================== */}
      {showAbonoModal && selectedCredito && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              Abonar a Cuenta
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-4">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
                {successMsg}
              </div>
            )}

            <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-xs space-y-1.5 mb-4">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">Cliente:</span>
                <span className="text-white font-bold">{selectedCredito.cliente_nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">Total Deuda:</span>
                <span className="text-zinc-300 font-bold">${selectedCredito.total_deuda.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">Monto Abonado:</span>
                <span className="text-emerald-400 font-bold">${selectedCredito.total_pagado.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/5 text-sm">
                <span className="text-amber-500 font-black uppercase">Saldo Restante:</span>
                <span className="text-amber-500 font-black">${(selectedCredito.total_deuda - selectedCredito.total_pagado).toLocaleString('es-CO')}</span>
              </div>
            </div>

            <form onSubmit={submitAbono} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Monto del Abono ($ COP)
                </label>
                <input
                  type="number"
                  required
                  value={abonoMonto || ''}
                  onChange={(e) => setAbonoMonto(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Monto a entregar en caja"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAllModals}
                  className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold transition-all cursor-pointer"
                >
                  Registrar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: REGISTRAR PRÉSTAMO DE BOTELLAS */}
      {/* ============================================================== */}
      {showAddLoanModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              Registrar Préstamo de Envase
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-4">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
                {successMsg}
              </div>
            )}

            <form onSubmit={submitAddLoan} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  value={prestamoClienteNombre}
                  onChange={(e) => setPrestamoClienteNombre(e.target.value)}
                  placeholder="Ej. Pedro Gómez"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Vincular a Producto de Bodega (Opcional)
                </label>
                <select
                  value={prestamoSelectedProdId}
                  onChange={(e) => handleProductSelectChange(e.target.value)}
                  className="w-full h-9 px-2 rounded-lg bg-[#0a0a0c] border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">-- No vincular / Préstamo de envase vacío --</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock: {p.stock_actual})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Detalle del Envase / Botella
                </label>
                <input
                  type="text"
                  required
                  value={prestamoBotellaNombre}
                  onChange={(e) => setPrestamoBotellaNombre(e.target.value)}
                  placeholder="Ej. Envase Cerveza Corona Extra"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={prestamoCantidad || ''}
                    onChange={(e) => setPrestamoCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Responsable
                  </label>
                  <input
                    type="text"
                    required
                    value={prestamoAtendidoPor}
                    onChange={(e) => setPrestamoAtendidoPor(e.target.value)}
                    placeholder="Mesero"
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>
              </div>

              {prestamoSelectedProdId && (
                <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <input
                    type="checkbox"
                    id="descontar_stock_chk"
                    checked={prestamoDescontarStock}
                    onChange={(e) => setPrestamoDescontarStock(e.target.checked)}
                    className="accent-amber-500 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="descontar_stock_chk" className="text-[10px] text-zinc-200 font-bold select-none cursor-pointer">
                    Descontar botellas físicamente de Bodega Stock
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Notas de Préstamo
                </label>
                <textarea
                  value={prestamoNotas}
                  onChange={(e) => setPrestamoNotas(e.target.value)}
                  placeholder="Ej. Prestó botellas vacías para evento, devuelve el lunes..."
                  className="w-full h-14 p-2 rounded-lg glass-input text-xs text-white resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAllModals}
                  className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold transition-all cursor-pointer"
                >
                  Registrar Préstamo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: CONFIRMAR DEVOLUCIÓN DE BOTELLAS */}
      {/* ============================================================== */}
      {showDevolverModal && selectedPrestamo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              Retorno de Envases
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-4">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
                {successMsg}
              </div>
            )}

            <p className="text-xs text-zinc-400 mb-4">
              ¿Confirmas que el cliente <strong className="text-white">{selectedPrestamo.cliente_nombre}</strong> ha devuelto exitosamente las <strong className="text-white">{selectedPrestamo.cantidad}</strong> botellas de <strong className="text-white">{selectedPrestamo.botella_nombre}</strong>?
            </p>

            {selectedPrestamo.descontó_stock && (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
                <input
                  type="checkbox"
                  id="reintegrar_stock_chk"
                  checked={devolverReintegrarStock}
                  onChange={(e) => setDevolverReintegrarStock(e.target.checked)}
                  className="accent-emerald-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="reintegrar_stock_chk" className="text-[10px] text-zinc-200 font-bold select-none cursor-pointer">
                  Reintegrar físicamente las botellas al stock de Bodega
                </label>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeAllModals}
                className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitDevolucion}
                className="flex-1 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition-all cursor-pointer"
              >
                Confirmar Retorno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: DETALLE DE VENTA / TICKET DE LA DEUDA */}
      {/* ============================================================== */}
      {showVentaModal && selectedVenta && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative shadow-2xl overflow-hidden">
            {/* Top gold line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
            
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Detalle del Ticket de Venta</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Venta vinculada #{selectedVenta.id}</p>
            </div>

            {/* Simulated 80mm ticket preview inside our premium UI */}
            <div className="bg-white text-black p-4 rounded-xl font-mono text-[10.5px] border border-zinc-200 shadow-inner max-h-64 overflow-y-auto mb-4">
              <div className="text-center font-bold mb-2">
                <p className="text-xs tracking-wider">ALICO BAR</p>
                <p className="text-[8px]">SERVICIOS DE BAR Y COCTELERÍA</p>
                <p className="text-[7.5px] font-normal mt-0.5">Sede: {selectedVenta.sede_id === 'sede-norte' ? 'Norte' : 'Centro'}</p>
              </div>
              <div className="border-t border-dashed border-black my-1"></div>
              <p className="text-[9px]">Fecha: {new Date(selectedVenta.fecha_hora).toLocaleString('es-CO')}</p>
              <p className="text-[9px]">Atendió: {selectedVenta.atendido_por}</p>
              <p className="text-[9px]">Cliente: {selectedVenta.cliente_nombre || 'Cliente General'}</p>
              <div className="border-t border-dashed border-black my-1"></div>
              <table className="w-full text-left border-collapse text-[9.5px]">
                <thead>
                  <tr className="border-b border-dashed border-black">
                    <th>Detalle</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVenta.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.cantidad}x {item.nombre}</td>
                      <td className="text-right">${(item.precio_unitario * item.cantidad).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-dashed border-black my-1"></div>
              {selectedVenta.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0) > selectedVenta.total && (
                <div className="flex justify-between text-red-700">
                  <span>Descuento:</span>
                  <span>-${(Math.max(0, selectedVenta.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0) - selectedVenta.total)).toLocaleString('es-CO')}</span>
                </div>
              )}
              <div className="border-t border-dashed border-black my-1"></div>
              <div className="flex justify-between font-bold text-xs">
                <span>TOTAL:</span>
                <span>${selectedVenta.total.toLocaleString('es-CO')}</span>
              </div>
              <p className="text-[8.5px] mt-1 font-bold">Pago: {selectedVenta.metodo_pago}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  printThermalReceipt(selectedVenta);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.821V7.5a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v6.321m-10.5 0h10.5m-10.5 0l-1.3-9.103a.75.75 0 01.737-.855h11.626a.75.75 0 01.737.855l-1.3 9.103m-10.5 0V18a1.5 1.5 0 001.5 1.5h7.5A1.5 1.5 0 0018 18v-4.179M9 15h6" />
                </svg>
                Imprimir Tiquete
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVentaModal(false);
                  setSelectedVenta(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
