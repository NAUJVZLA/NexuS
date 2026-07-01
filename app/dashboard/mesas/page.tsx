'use client';

import { useState, useEffect } from 'react';
import { mockDb, Mesa, Producto, ConsumoItem, Venta } from '@/lib/supabaseClient';
import { printThermalReceipt } from '@/lib/printUtils';

export default function MesasPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  
  // Modals state
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddConsumoModal, setShowAddConsumoModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Venta completada de mesa para previsualización e impresión
  const [completedVenta, setCompletedVenta] = useState<Venta | null>(null);
  const [lastCheckoutMesaNum, setLastCheckoutMesaNum] = useState('');

  // Forms state
  const [clienteNombreInput, setClienteNombreInput] = useState('');
  const [atendidoPorInput, setAtendidoPorInput] = useState('');
  
  // Agregar consumo form
  const [selectedProdId, setSelectedProdId] = useState('');
  const [cantidadInput, setCantidadInput] = useState(1);
  const [atendidoPorConsumo, setAtendidoPorConsumo] = useState('');
  const [clienteNombreConsumo, setClienteNombreConsumo] = useState('');
  const [entregadoPorConsumo, setEntregadoPorConsumo] = useState('');
  const [busquedaConsumo, setBusquedaConsumo] = useState('');
  const [categoriaConsumo, setCategoriaConsumo] = useState('TODOS');

  // Edición nombre mesa
  const [isEditingMesaName, setIsEditingMesaName] = useState(false);
  const [mesaNameInput, setMesaNameInput] = useState('');

  // Checkout form
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO'>('EFECTIVO');
  
  // Gestión de mesas para admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddMesaModal, setShowAddMesaModal] = useState(false);
  const [nuevaMesaNumero, setNuevaMesaNumero] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadSedeData = () => {
    const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
    setActiveSedeId(currentSedeId);
    setMesas(mockDb.getMesas(currentSedeId));
    setProductos(mockDb.getProductos(currentSedeId));
  };

  useEffect(() => {
    loadSedeData();

    // Validar rol de administrador
    const sessionStr = localStorage.getItem('alico_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setIsAdmin(session.role === 'admin');
      } catch (e) {
        console.error(e);
      }
    }

    // Sincronizar reactivamente al cambiar de sede
    const handleSedeChange = () => {
      loadSedeData();
      closeAllModals();
    };
    const handleCloudSync = () => { loadSedeData(); };
    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);
    return () => { window.removeEventListener('sedeChanged', handleSedeChange); window.removeEventListener('cloudSync', handleCloudSync); };
  }, []);

  // Categorías de productos para el consumo de mesas
  const categoriasConsumo = ['TODOS', ...Array.from(new Set(productos.map(p => p.categoria)))];

  // Productos ordenados alfabéticamente y filtrados para el consumo de mesas
  const productosFiltradosConsumo = [...productos]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(busquedaConsumo.toLowerCase()) || 
                            (p.codigo_barras || '').includes(busquedaConsumo);
      const matchesCategory = categoriaConsumo === 'TODOS' || p.categoria === categoriaConsumo;
      return matchesSearch && matchesCategory;
    });

  // Limpiar selección de producto si el producto elegido es filtrado fuera de la lista
  useEffect(() => {
    if (selectedProdId) {
      const exists = productosFiltradosConsumo.some(p => p.id === selectedProdId);
      if (!exists) {
        setSelectedProdId('');
      }
    }
  }, [productosFiltradosConsumo, selectedProdId]);

  const closeAllModals = () => {
    setSelectedMesa(null);
    setShowOpenModal(false);
    setShowDetailModal(false);
    setShowAddConsumoModal(false);
    setShowCheckoutModal(false);
    setShowAddMesaModal(false);
    setNuevaMesaNumero('');
    setClienteNombreInput('');
    setAtendidoPorInput('');
    setSelectedProdId('');
    setCantidadInput(1);
    setAtendidoPorConsumo('');
    setClienteNombreConsumo('');
    setEntregadoPorConsumo('');
    setIsEditingMesaName(false);
    setErrorMsg('');
    setSuccessMsg('');
    setBusquedaConsumo('');
    setCategoriaConsumo('TODOS');
  };

  // 1. ABRIR MESA (DISPONIBLE -> OCUPADA)
  const handleOpenMesaClick = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setShowOpenModal(true);
  };

  const submitOpenMesa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMesa) return;
    if (!clienteNombreInput.trim() || !atendidoPorInput.trim()) {
      setErrorMsg('Por favor rellena todos los campos para auditoría.');
      return;
    }

    mockDb.updateMesaEstado(selectedMesa.id, 'OCUPADA', { cliente_nombre: clienteNombreInput });
    setSuccessMsg(`¡Mesa ${selectedMesa.numero_mesa} abierta con éxito! Redirigiendo a comandas...`);
    
    // Guardar atendido por en local para recordar responsable
    localStorage.setItem('alico_last_waiter', atendidoPorInput);
    
    loadSedeData();
    const updatedMesa = mockDb.getMesas(activeSedeId).find(m => m.id === selectedMesa.id);
    
    setTimeout(() => {
      // Cerramos modal de apertura y abrimos comanda directamente
      setShowOpenModal(false);
      setErrorMsg('');
      setSuccessMsg('');
      
      if (updatedMesa) {
        setSelectedMesa(updatedMesa);
        setAtendidoPorConsumo(atendidoPorInput);
        setEntregadoPorConsumo(atendidoPorInput);
        setShowAddConsumoModal(true);
      } else {
        closeAllModals();
      }
    }, 600);
  };

  // 2. VER DETALLES MESA (OCUPADA o PAGANDO)
  const handleDetailMesaClick = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setShowDetailModal(true);
    // Cargar mesero guardado
    const cachedWaiter = localStorage.getItem('alico_last_waiter') || '';
    setAtendidoPorConsumo(cachedWaiter);
    setEntregadoPorConsumo(cachedWaiter); // Sugerir el mismo por defecto
  };

  const submitEditMesaName = () => {
    if (!selectedMesa || !mesaNameInput.trim()) return;
    mockDb.updateMesaEstado(selectedMesa.id, selectedMesa.estado, { numero_mesa: mesaNameInput.trim() });
    setSuccessMsg('Nombre de mesa actualizado.');
    setIsEditingMesaName(false);
    loadSedeData();
    const updatedMesa = mockDb.getMesas(activeSedeId).find(m => m.id === selectedMesa.id);
    if (updatedMesa) setSelectedMesa(updatedMesa);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  // 3. AGREGAR CONSUMO A MESA
  const handleAddConsumoClick = () => {
    setShowDetailModal(false);
    setShowAddConsumoModal(true);
  };

  const submitAddConsumo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMesa) return;
    if (!selectedProdId) {
      setErrorMsg('Por favor selecciona un producto.');
      return;
    }
    if (!atendidoPorConsumo.trim()) {
      setErrorMsg('Especifica qué mesero agrega la ronda.');
      return;
    }

    const prod = productos.find(p => p.id === selectedProdId);
    if (!prod) return;

    try {
      mockDb.agregarConsumoMesa(selectedMesa.id, {
        producto_id: prod.id,
        nombre: prod.nombre,
        cantidad: cantidadInput,
        precio_unitario: prod.precio_venta,
        registrado_por: atendidoPorConsumo,
        cliente_nombre: clienteNombreConsumo.trim() || undefined,
        entregado_por: entregadoPorConsumo.trim() || undefined
      });
      
      // Guardar mesero
      localStorage.setItem('alico_last_waiter', atendidoPorConsumo);
      
      setSuccessMsg('Consumo añadido con éxito y stock descontado.');
      
      // Recargar y volver al detalle
      loadSedeData();
      setTimeout(() => {
        // Encontrar mesa actualizada
        const updatedMesa = mockDb.getMesas(activeSedeId).find(m => m.id === selectedMesa.id);
        closeAllModals();
        if (updatedMesa) {
          handleDetailMesaClick(updatedMesa);
        }
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al agregar consumo.');
    }
  };

  // 4. CANCELAR CONSUMO (QUITAR ITEM DE LA MESA)
  const handleCancelConsumo = (consumoId: string) => {
    if (!selectedMesa) return;
    if (!confirm('¿Deseas cancelar este consumo? El stock regresará a bodega de forma auditada.')) return;

    const waiter = localStorage.getItem('alico_last_waiter') || 'Administrador';
    const res = mockDb.cancelarConsumoMesa(selectedMesa.id, consumoId, waiter);
    
    loadSedeData();
    if (res) {
      setSelectedMesa(res);
      setSuccessMsg('Consumo cancelado y stock retornado a bodega.');
      setTimeout(() => setErrorMsg(''), 2000);
    } else {
      closeAllModals();
    }
  };

  // 4.1 CANCELAR TODOS LOS CONSUMOS Y LIBERAR MESA (DISPONIBLE)
  const handleReleaseMesa = (mesaToRelease?: Mesa) => {
    const targetMesa = mesaToRelease || selectedMesa;
    if (!targetMesa) return;

    const hasConsumos = targetMesa.consumos && targetMesa.consumos.length > 0;
    const confirmMsg = hasConsumos
      ? `¿Estás seguro de que deseas liberar la ${targetMesa.numero_mesa}? Se cancelarán todos los consumos cargados (${targetMesa.consumos.length} items) y el stock retornará a bodega.`
      : `¿Estás seguro de que deseas liberar la ${targetMesa.numero_mesa} y dejarla disponible?`;

    if (!confirm(confirmMsg)) return;

    const waiter = localStorage.getItem('alico_last_waiter') || 'Administrador';
    mockDb.liberarMesaTotalmente(targetMesa.id, waiter);

    setSuccessMsg(`Mesa ${targetMesa.numero_mesa} liberada y disponible.`);
    loadSedeData();

    setTimeout(() => {
      closeAllModals();
      // Emitir cambio de sede global para actualizar dashboard
      window.dispatchEvent(new Event('sedeChanged'));
    }, 800);
  };

  const handleCreateMesa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaMesaNumero.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      mockDb.agregarMesa(activeSedeId, nuevaMesaNumero.trim());
      setSuccessMsg('¡Mesa creada con éxito!');
      loadSedeData();
      setShowAddMesaModal(false);
      setNuevaMesaNumero('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear mesa.');
    }
  };

  const handleDeleteMesa = (mesaId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta mesa de forma permanente?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      mockDb.eliminarMesa(mesaId);
      setSuccessMsg('Mesa eliminada con éxito.');
      loadSedeData();
      closeAllModals();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la mesa.');
    }
  };

  // 5. SOLICITAR CUENTA (OCUPADA -> PAGANDO)
  const handleRequestBill = () => {
    if (!selectedMesa) return;
    mockDb.updateMesaEstado(selectedMesa.id, 'PAGANDO');
    loadSedeData();
    const updatedMesa = mockDb.getMesas(activeSedeId).find(m => m.id === selectedMesa.id);
    if (updatedMesa) {
      setSelectedMesa(updatedMesa);
    }
    setSuccessMsg('Estado cambiado a: Pidiendo Cuenta.');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  // 6. CERRAR Y COBRAR MESA (PAGANDO -> DISPONIBLE)
  const handleCheckoutClick = () => {
    setShowDetailModal(false);
    setShowCheckoutModal(true);
  };

  const submitCheckoutMesa = () => {
    if (!selectedMesa) return;
    const total = selectedMesa.consumos.reduce((s, c) => s + (c.precio_unitario * c.cantidad), 0);
    const waiter = localStorage.getItem('alico_last_waiter') || 'Administrador';

    if (metodoPago === 'CREDITO' && (!selectedMesa.cliente_nombre.trim() || selectedMesa.cliente_nombre.trim() === 'Cliente General')) {
      setErrorMsg('Debe registrar un nombre real para el cliente de la mesa antes de poder cerrar a crédito / fiar la cuenta.');
      return;
    }

    try {
      // Registrar venta
      const itemsVenta = selectedMesa.consumos.map(c => ({
        producto_id: c.producto_id,
        nombre: c.nombre,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario
      }));

      const createdVenta = mockDb.registrarVenta({
        sede_id: activeSedeId,
        cliente_nombre: selectedMesa.cliente_nombre,
        total: total,
        metodo_pago: metodoPago,
        atendido_por: waiter,
        es_directa: false, // El stock ya se redujo cuando se agregaron los consumos
        items: itemsVenta
      });

      // Guardar mesaNumero y venta completada
      setLastCheckoutMesaNum(selectedMesa.numero_mesa);
      setCompletedVenta(createdVenta);

      // Liberar mesa
      mockDb.updateMesaEstado(selectedMesa.id, 'DISPONIBLE');
      
      setSuccessMsg('Mesa cobrada y liberada con éxito. ¡Venta registrada!');
      
      // Recargar todo
      loadSedeData();
      
      // Emitir cambio de sede global para actualizar dashboard
      window.dispatchEvent(new Event('sedeChanged'));
      
      // Ocultar modal de cobro y dejar que el ticket digital tome el control
      setShowCheckoutModal(false);
      setSelectedMesa(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar cobro.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Control de Mesas</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Mapa de consumo y salones del establecimiento.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddMesaModal(true)}
            className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Agregar Mesa
          </button>
        )}
      </div>

      {/* Leyenda de estados */}
      <div className="flex flex-wrap gap-4 p-3 bg-zinc-950/40 border border-white/5 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-md bg-emerald-500/20 border border-emerald-500/40"></span>
          <span className="text-[10px] font-bold text-emerald-400">Libre / Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-md bg-red-500/20 border border-red-500/40"></span>
          <span className="text-[10px] font-bold text-red-400">Ocupada / Consumiendo</span>
        </div>
        <div className="flex items-center gap-2 animate-pulse">
          <span className="h-3.5 w-3.5 rounded-md bg-yellow-500/20 border border-yellow-500/40"></span>
          <span className="text-[10px] font-bold text-yellow-400">Pidiendo Cuenta (Pagar)</span>
        </div>
      </div>

      {/* Grid del Salón de Mesas */}
      {mesas.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-xs text-zinc-400">No hay mesas configuradas para esta sede.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {mesas.map((mesa) => {
            const subtotalMesa = mesa.consumos.reduce((s, c) => s + (c.precio_unitario * c.cantidad), 0);
            const isOpen = mesa.estado === 'OCUPADA';
            const isPaying = mesa.estado === 'PAGANDO';
            const isFree = mesa.estado === 'DISPONIBLE';

            return (
              <div
                key={mesa.id}
                onClick={() => isFree ? handleOpenMesaClick(mesa) : handleDetailMesaClick(mesa)}
                className={`group glass-card rounded-2xl p-5 border text-left flex flex-col justify-between h-40 transition-all cursor-pointer relative overflow-hidden ${
                  isFree
                    ? 'border-emerald-500/10 hover:border-emerald-500/35 hover:bg-emerald-950/5'
                    : isPaying
                      ? 'border-yellow-500/30 hover:border-yellow-500/50 hover:bg-yellow-950/5 glow-amber animate-pulse'
                      : 'border-red-500/15 hover:border-red-500/35 hover:bg-red-950/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg text-black ${
                      isFree
                        ? 'bg-emerald-500'
                        : isPaying
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}>
                      {mesa.numero_mesa}
                    </span>
                    
                    {/* Acciones rápidas discretas en hover */}
                    {!isFree ? (
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMesa(mesa);
                            const cachedWaiter = localStorage.getItem('alico_last_waiter') || '';
                            setAtendidoPorConsumo(cachedWaiter);
                            setEntregadoPorConsumo(cachedWaiter);
                            setShowAddConsumoModal(true);
                          }}
                          className="p-1 rounded bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                          title="Cargar Ronda Rápida"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReleaseMesa(mesa)}
                          className="p-1 rounded bg-red-950/40 border border-red-500/20 hover:bg-red-900/40 text-red-400 hover:text-red-300"
                          title="Liberar/Vaciar Mesa"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3a.75.75 0 000 1.5h1v10A2.25 2.25 0 006.25 17.75h7.5A2.25 2.25 0 0016 15.5v-10h1a.75.75 0 000-1.5h-3v-.25A2.75 2.75 0 0011.25 1h-2.5zM8 4h4v-.25a1.25 1.25 0 00-1.25-1.25h-2.5A1.25 1.25 0 008 3.75V4zM5.5 5.5h9v10a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-10z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
                        + ABRIR
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-extrabold text-white mt-3 truncate max-w-[120px]">
                    {isFree ? 'Vacía' : mesa.cliente_nombre || 'Cliente General'}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {!isFree && `${mesa.consumos.length} items ordenados`}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between w-full">
                  <p className="text-[10px] text-zinc-400 font-semibold">Total Bill</p>
                  <p className={`text-xs font-black ${isFree ? 'text-zinc-500' : 'text-amber-500'}`}>
                    ${subtotalMesa.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ABRIR MESA (DISPONIBLE -> OCUPADA) */}
      {/* ============================================================== */}
      {showOpenModal && selectedMesa && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              Abrir {selectedMesa.numero_mesa}
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={submitOpenMesa} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  value={clienteNombreInput}
                  onChange={(e) => setClienteNombreInput(e.target.value)}
                  placeholder="Ej. Andrés López o Mesa 4"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  ¿Quién atiende la mesa?
                </label>
                <input
                  type="text"
                  required
                  value={atendidoPorInput}
                  onChange={(e) => setAtendidoPorInput(e.target.value)}
                  placeholder="Ej. Diana Cajera"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAllModals}
                  className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold transition-all"
                >
                  Abrir Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: VER DETALLE DE CONSUMOS (OCUPADA / PAGANDO) */}
      {/* ============================================================== */}
      {showDetailModal && selectedMesa && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-lg w-full relative">
            
            {/* Header del detalle */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {isEditingMesaName ? (
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={mesaNameInput} 
                        onChange={(e) => setMesaNameInput(e.target.value)}
                        className="h-6 px-2 text-[10px] rounded bg-zinc-900 border border-white/10 text-white w-32"
                        autoFocus
                      />
                      <button onClick={submitEditMesaName} className="text-emerald-400 p-1 hover:text-emerald-300">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                      </button>
                      <button onClick={() => setIsEditingMesaName(false)} className="text-red-400 p-1 hover:text-red-300">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase bg-amber-500 text-black px-2.5 py-0.5 rounded-md">
                        {selectedMesa.numero_mesa}
                      </span>
                      <button 
                        onClick={() => { setMesaNameInput(selectedMesa.numero_mesa); setIsEditingMesaName(true); }}
                        className="text-zinc-500 hover:text-white transition-colors"
                        title="Editar nombre de la mesa"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 font-semibold">
                  Cliente: <span className="text-white">{selectedMesa.cliente_nombre}</span>
                </span>
              </div>
              <button onClick={closeAllModals} className="text-zinc-500 hover:text-white text-xs">
                Cerrar
              </button>
            </div>

            {successMsg && (
              <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
                {successMsg}
              </div>
            )}

            {/* Listado de items consumidos */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 mb-4">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Consumo Acumulado</p>
              {selectedMesa.consumos.length === 0 ? (
                <p className="text-[10px] text-zinc-500 text-center py-4">No hay consumos registrados. ¡Agrega una ronda!</p>
              ) : (
                selectedMesa.consumos.map((c) => (
                  <div key={c.id} className="p-2.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                    <div className="truncate flex-1">
                      <p className="text-[11px] font-bold text-white truncate">{c.nombre}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">
                        {c.cantidad} U. • ${c.precio_unitario.toLocaleString('es-CO')} c/u
                      </p>
                      {(c.cliente_nombre || c.entregado_por) && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {c.cliente_nombre && <span className="text-[8px] bg-blue-500/20 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded">Pidió: {c.cliente_nombre}</span>}
                          {c.entregado_por && <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded">Entregó: {c.entregado_por}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] font-extrabold text-white">
                        ${(c.precio_unitario * c.cantidad).toLocaleString('es-CO')}
                      </p>
                      <button
                        onClick={() => handleCancelConsumo(c.id)}
                        className="text-red-500 hover:text-red-400 p-1"
                        title="Cancelar consumo (retorna a bodega)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3a.75.75 0 000 1.5h1v10A2.25 2.25 0 006.25 17.75h7.5A2.25 2.25 0 0016 15.5v-10h1a.75.75 0 000-1.5h-3v-.25A2.75 2.75 0 0011.25 1h-2.5zM8 4h4v-.25a1.25 1.25 0 00-1.25-1.25h-2.5A1.25 1.25 0 008 3.75V4zM5.5 5.5h9v10a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-10z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Resumen de consumos acumulados */}
            {selectedMesa.consumos.length > 0 && (
              <div className="p-3 bg-zinc-950/80 border border-white/5 rounded-xl mb-4 space-y-1">
                <div className="flex justify-between text-xs font-black text-white">
                  <span className="text-amber-500">Total Acumulado</span>
                  <span className="text-amber-500">${selectedMesa.consumos.reduce((s, c) => s + (c.precio_unitario * c.cantidad), 0).toLocaleString('es-CO')}</span>
                </div>
              </div>
            )}

            {/* Acciones principales de mesa */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleAddConsumoClick}
                  className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  + Cargar Bebidas / Rondas
                </button>

                {selectedMesa.consumos.length > 0 && (
                  <>
                    {selectedMesa.estado === 'OCUPADA' ? (
                      <button
                        type="button"
                        onClick={handleRequestBill}
                        className="flex-1 h-9 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        Pide Cuenta (Amarillo)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCheckoutClick}
                        className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        Cerrar y Cobrar Mesa
                      </button>
                    )}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleReleaseMesa()}
                className="w-full h-9 rounded-lg bg-red-950/20 border border-red-500/20 hover:bg-red-900/30 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                ❌ Cancelar y Liberar Mesa (Por error)
              </button>
              {isAdmin && selectedMesa.estado === 'DISPONIBLE' && (
                <button
                  type="button"
                  onClick={() => handleDeleteMesa(selectedMesa.id)}
                  className="w-full h-9 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-500/35 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Eliminar Mesa del Sistema
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: AGREGAR CONSUMO (PEDIDOS/COMANDAS) */}
      {/* ============================================================== */}
      {showAddConsumoModal && selectedMesa && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              Cargar Pedido a {selectedMesa.numero_mesa}
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={submitAddConsumo} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Buscar Producto
                </label>
                <div className="relative mb-3">
                  <input
                    type="text"
                    value={busquedaConsumo}
                    onChange={(e) => setBusquedaConsumo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Buscar por nombre o código..."
                    className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs text-white font-sans"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
                    </svg>
                  </div>
                </div>

                {/* Categorías slider/tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
                  {categoriasConsumo.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoriaConsumo(cat)}
                      className={`py-1 px-2.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                        categoriaConsumo === cat
                          ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                          : 'bg-zinc-950/40 text-zinc-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Seleccionar Producto ({productosFiltradosConsumo.length})
                </label>
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  required
                  className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg py-2 px-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">Selecciona un licor / bebida...</option>
                  {productosFiltradosConsumo.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.stock_actual <= 0}>
                      {p.nombre} (Stock: {p.stock_actual}) - ${p.precio_venta.toLocaleString('es-CO')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cantidadInput}
                    onChange={(e) => setCantidadInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Mesero que Registra
                  </label>
                  <input
                    type="text"
                    required
                    value={atendidoPorConsumo}
                    onChange={(e) => setAtendidoPorConsumo(e.target.value)}
                    placeholder="Ej. Diana Cajera"
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    ¿Quién pidió? (Opcional)
                  </label>
                  <input
                    type="text"
                    value={clienteNombreConsumo}
                    onChange={(e) => setClienteNombreConsumo(e.target.value)}
                    placeholder="Ej. VIP Sr. Carlos"
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    ¿Quién entrega? (Opcional)
                  </label>
                  <input
                    type="text"
                    value={entregadoPorConsumo}
                    onChange={(e) => setEntregadoPorConsumo(e.target.value)}
                    placeholder="Ej. Juan Mesero"
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    closeAllModals();
                    handleDetailMesaClick(selectedMesa);
                  }}
                  className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold transition-all"
                >
                  Agregar Ronda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: COBRAR Y FACTURAR MESA (PAGANDO -> DISPONIBLE) */}
      {/* ============================================================== */}
      {showCheckoutModal && selectedMesa && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              Cobrar {selectedMesa.numero_mesa}
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

            <div className="space-y-4">
              <div className="p-3.5 bg-black/60 border border-white/5 rounded-2xl">
                <div className="flex justify-between text-[10px] text-zinc-400 font-semibold mb-1">
                  <span>Cliente</span>
                  <span className="text-white font-bold">{selectedMesa.cliente_nombre}</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400 font-semibold mb-2">
                  <span>Consumos acumulados</span>
                  <span className="text-white font-bold">{selectedMesa.consumos.length} items</span>
                </div>
                
                <div className="flex justify-between text-xs font-black text-white pt-2 border-t border-white/5">
                  <span className="text-amber-500">Monto Facturado</span>
                  <span className="text-amber-500">${selectedMesa.consumos.reduce((s, c) => s + (c.precio_unitario * c.cantidad), 0).toLocaleString('es-CO')}</span>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Método de Pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e: any) => setMetodoPago(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg py-2.5 px-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia bancaria / Nequi</option>
                  <option value="CREDITO">Crédito (Fiar Cuenta)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    closeAllModals();
                    handleDetailMesaClick(selectedMesa);
                  }}
                  className="flex-1 h-9 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={submitCheckoutMesa}
                  className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold transition-all"
                >
                  Cerrar Venta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TICKET PREVISUALIZADOR Y ACCIÓN DE IMPRESIÓN */}
      {completedVenta && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full relative shadow-2xl overflow-hidden">
            {/* Top gold line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
            
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">¡Cuenta Cerrada y Cobrada!</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Mesa: {lastCheckoutMesaNum} • Factura #{completedVenta.id}</p>
            </div>

            {/* Simulated 80mm ticket preview inside our premium UI */}
            <div className="bg-white text-black p-4 rounded-xl font-mono text-[10.5px] border border-zinc-200 shadow-inner max-h-64 overflow-y-auto mb-4">
              <div className="text-center font-bold mb-2">
                <p className="text-xs tracking-wider">ALICO BAR</p>
                <p className="text-[8px]">SERVICIOS DE BAR Y COCTELERÍA</p>
                <p className="text-[7.5px] font-normal mt-0.5">Sede: {completedVenta.sede_id === 'sede-norte' ? 'Norte' : 'Centro'}</p>
              </div>
              <div className="border-t border-dashed border-black my-1"></div>
              <p className="text-[9px]">Fecha: {new Date(completedVenta.fecha_hora).toLocaleString('es-CO')}</p>
              <p className="text-[9px]">Atendió: {completedVenta.atendido_por}</p>
              <p className="text-[9px]">Cliente: {completedVenta.cliente_nombre || 'Cliente General'}</p>
              <p className="text-[9px]"><strong>Mesa:</strong> {lastCheckoutMesaNum}</p>
              <div className="border-t border-dashed border-black my-1"></div>
              <table className="w-full text-left border-collapse text-[9.5px]">
                <thead>
                  <tr className="border-b border-dashed border-black">
                    <th>Detalle</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {completedVenta.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.cantidad}x {item.nombre}</td>
                      <td className="text-right">${(item.precio_unitario * item.cantidad).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-dashed border-black my-1"></div>
              <div className="flex justify-between font-bold text-xs">
                <span>TOTAL:</span>
                <span>${completedVenta.total.toLocaleString('es-CO')}</span>
              </div>
              <p className="text-[8.5px] mt-1 font-bold">Pago: {completedVenta.metodo_pago}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  printThermalReceipt(completedVenta, lastCheckoutMesaNum);
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
                  setCompletedVenta(null);
                  setLastCheckoutMesaNum('');
                }}
                className="py-2.5 px-4 rounded-xl bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA MESA */}
      {showAddMesaModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="glass-card rounded-3xl p-6 border border-white/10 max-w-sm w-full relative overflow-hidden bg-[#06060c]/95">
            <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none bg-amber-500"></div>

            <div className="text-center mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Agregar Nueva Mesa</h3>
              <p className="text-[10px] text-zinc-500 mt-1">Crea una nueva mesa de consumo para la sede activa.</p>
            </div>

            <form onSubmit={handleCreateMesa} className="space-y-4 text-left">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Identificador / Número de Mesa
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nuevaMesaNumero}
                  onChange={(e) => setNuevaMesaNumero(e.target.value)}
                  placeholder="Ej. Mesa 12 o Barra Norte"
                  className="w-full h-10 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  Crear e Inyectar Mesa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMesaModal(false);
                    setNuevaMesaNumero('');
                  }}
                  className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 hover:text-white text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
