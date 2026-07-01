'use client';

import { useState, useEffect } from 'react';
import { mockDb, Producto, VentaItem, Venta } from '@/lib/supabaseClient';
import { printThermalReceipt } from '@/lib/printUtils';

interface CartItem {
  producto: Producto;
  cantidad: number;
}

export default function VentasPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]); // Para el historial
  const [sedes, setSedes] = useState<any[]>([]); // Para tiquetes dinámicos
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('TODOS');
  const [activeTab, setActiveTab] = useState<'POS' | 'HISTORIAL'>('POS');
  const [groupByDay, setGroupByDay] = useState(false); // Vista agrupada por día
  
  // Cart & Checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [atendidoPor, setAtendidoPor] = useState('');
  const [clienteNombre, setClienteNombre] = useState('Cliente General');
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO'>('EFECTIVO');
  const [descuento, setDescuento] = useState<number>(0);
  
  // Simulated Barcode Scanner State
  const [simulatedCode, setSimulatedCode] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Venta completada para previsualización e impresión
  const [completedVenta, setCompletedVenta] = useState<Venta | null>(null);

  const loadSedeData = () => {
    const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
    setActiveSedeId(currentSedeId);
    setProductos(mockDb.getProductos(currentSedeId));
    setVentas(mockDb.getVentas(currentSedeId).sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()));
    setSedes(mockDb.getSedes());
  };

  // Agrupar ventas por día
  const getVentasAgrupadasPorDia = () => {
    const grupos: {
      [fecha: string]: {
        fecha: string;
        total: number;
        cantVentas: number;
        efectivo: number;
        tarjeta: number;
        transferencia: number;
        credito: number;
      };
    } = {};

    // Solo ventas completadas
    ventas.filter(v => v.estado !== 'ANULADA').forEach(v => {
      const dateKey = new Date(v.fecha_hora).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      if (!grupos[dateKey]) {
        grupos[dateKey] = {
          fecha: dateKey,
          total: 0,
          cantVentas: 0,
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
          credito: 0
        };
      }

      grupos[dateKey].total += v.total;
      grupos[dateKey].cantVentas += 1;
      
      if (v.metodo_pago === 'EFECTIVO') grupos[dateKey].efectivo += v.total;
      else if (v.metodo_pago === 'TARJETA') grupos[dateKey].tarjeta += v.total;
      else if (v.metodo_pago === 'TRANSFERENCIA') grupos[dateKey].transferencia += v.total;
      else if (v.metodo_pago === 'CREDITO') grupos[dateKey].credito += v.total;
    });

    return Object.values(grupos).sort((a, b) => {
      const parseDate = (dStr: string) => {
        const [d, m, y] = dStr.split('/');
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
      };
      return parseDate(b.fecha) - parseDate(a.fecha);
    });
  };

  const ventasAgrupadasPorDia = getVentasAgrupadasPorDia();

  useEffect(() => {
    loadSedeData();

    // Comprobar parámetro de pestaña en la URL de forma segura en el cliente
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'HISTORIAL') {
        setActiveTab('HISTORIAL');
      }
      const groupParam = params.get('group');
      if (groupParam === 'day') {
        setGroupByDay(true);
      }
    }

    // Sincronizar reactivamente al cambiar de sede
    const handleSedeChange = () => {
      loadSedeData();
      setCart([]); // Limpiar carrito al cambiar de sede para evitar mezclar productos
    };
    const handleCloudSync = () => { loadSedeData(); };
    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);
    return () => { window.removeEventListener('sedeChanged', handleSedeChange); window.removeEventListener('cloudSync', handleCloudSync); };
  }, []);

  // Categorías únicas
  const categorias = ['TODOS', ...Array.from(new Set(productos.map(p => p.categoria)))];

  // Filtrado de productos ordenados alfabéticamente
  const productosFiltrados = [...productos]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                            (p.codigo_barras || '').includes(busqueda);
      const matchesCategory = categoriaActiva === 'TODOS' || p.categoria === categoriaActiva;
      return matchesSearch && matchesCategory;
    });

  // Agregar al carrito
  const addToCart = (producto: Producto) => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (producto.stock_actual <= 0) {
      setErrorMsg(`¡Agotado! ${producto.nombre} no tiene existencias.`);
      return;
    }

    const itemExistente = cart.find(item => item.producto.id === producto.id);
    if (itemExistente) {
      if (itemExistente.cantidad >= producto.stock_actual) {
        setErrorMsg(`Solo hay ${producto.stock_actual} unidades disponibles de ${producto.nombre}.`);
        return;
      }
      setCart(cart.map(item => 
        item.producto.id === producto.id 
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      setCart([...cart, { producto, cantidad: 1 }]);
    }
  };

  // Modificar cantidad en el carrito
  const updateCantidad = (productoId: string, delta: number) => {
    setErrorMsg('');
    setCart(cart.map(item => {
      if (item.producto.id === productoId) {
        const nuevaCant = item.cantidad + delta;
        if (nuevaCant <= 0) return null;
        if (nuevaCant > item.producto.stock_actual) {
          setErrorMsg(`Stock máximo alcanzado para ${item.producto.nombre}.`);
          return item;
        }
        return { ...item, cantidad: nuevaCant };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  // Remover del carrito
  const removeFromCart = (productoId: string) => {
    setCart(cart.filter(item => item.producto.id !== productoId));
  };

  // Simulación de lector de código de barras
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedCode.trim()) return;

    const prod = productos.find(p => p.codigo_barras === simulatedCode.trim());
    if (prod) {
      addToCart(prod);
      setSuccessMsg(`Código ${simulatedCode} escaneado: ${prod.nombre}`);
      setSimulatedCode('');
    } else {
      setErrorMsg(`No se encontró producto con código de barras: ${simulatedCode}`);
    }
  };

  // Cálculos de totales
  const subtotal = cart.reduce((sum, item) => sum + (item.producto.precio_venta * item.cantidad), 0);
  const total = Math.max(0, subtotal - descuento);

  // Registrar transacción de venta en barra
  const handleCheckout = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío.');
      return;
    }
    if (!atendidoPor.trim()) {
      setErrorMsg('Por favor especifica quién atiende en la barra para la auditoría.');
      return;
    }
    if (metodoPago === 'CREDITO' && (!clienteNombre.trim() || clienteNombre.trim() === 'Cliente General')) {
      setErrorMsg('Debe especificar el nombre real del cliente para poder registrar una venta a crédito / fiada.');
      return;
    }

    try {
      const itemsVenta: VentaItem[] = cart.map(item => ({
        producto_id: item.producto.id,
        nombre: item.producto.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio_venta
      }));

      const createdVenta = mockDb.registrarVenta({
        sede_id: activeSedeId,
        cliente_nombre: clienteNombre,
        total: total,
        metodo_pago: metodoPago,
        atendido_por: atendidoPor,
        es_directa: true, // Esto decrementa stock e inserta auditorías de bodega
        items: itemsVenta
      });

      // Guardar venta completada
      setCompletedVenta(createdVenta);

      // Limpiar estados
      setCart([]);
      setClienteNombre('Cliente General');
      setDescuento(0);
      setSuccessMsg('Venta registrada con éxito. ¡Stock de bodega actualizado!');
      
      // Recargar inventario
      loadSedeData();
      
      // Disparar evento global para refrescar el Dashboard principal
      window.dispatchEvent(new Event('sedeChanged'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error al procesar la venta.');
    }
  };

  const handleAnularVenta = (ventaId: string) => {
    const razon = window.prompt('¿Cuál es la razón de la anulación? El inventario será restaurado a bodega.');
    if (razon === null || !razon.trim()) return;

    try {
      let sessionUser = 'Administrador';
      try {
        const sessionStr = localStorage.getItem('alico_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          sessionUser = session.nombre || 'Administrador';
        }
      } catch (e) {}

      mockDb.anularVenta(ventaId, razon.trim(), atendidoPor || 'Administrador', sessionUser);
      setSuccessMsg(`Venta #${ventaId} anulada con éxito. Stock restaurado.`);
      loadSedeData();
      window.dispatchEvent(new Event('sedeChanged')); // Actualizar dashboard y KPIs
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al anular la venta.');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Terminal POS</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">Registra ventas directas en barra de forma inmediata.</p>
        </div>
        
        {/* Tabs switcher */}
        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
          <button 
            onClick={() => setActiveTab('POS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'POS' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}
          >
            Nueva Venta
          </button>
          <button 
            onClick={() => setActiveTab('HISTORIAL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'HISTORIAL' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}
          >
            Historial
          </button>
        </div>
      </div>

      {activeTab === 'POS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
        
        {/* LADO IZQUIERDO: Catálogo y Buscador (Ocupa 2 columnas) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Buscador y Lector de Código de barras simulado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Buscador de Texto */}
            <div className="relative">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full h-11 pl-10 pr-4 rounded-xl glass-input text-xs text-white"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
                </svg>
              </div>
            </div>

            {/* Simulador de Escáner de Código de Barras */}
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <input
                type="text"
                value={simulatedCode}
                onChange={(e) => setSimulatedCode(e.target.value)}
                placeholder="Lector Barras (Simula código y pulsa Enter)"
                className="flex-1 h-11 px-3 rounded-xl glass-input text-[11px] text-white"
              />
              <button
                type="submit"
                className="px-3 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM15 8.25a.75.75 0 100-1.5.75.75 0 000 1.5zM15 13.5a.75.75 0 100-1.5.75.75 0 000 1.5zM13.5 15a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V15zM17.25 13.5a.75.75 0 100-1.5.75.75 0 000 1.5zM17.25 18a.75.75 0 100-1.5.75.75 0 000 1.5zM13.5 19.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                </svg>
                Escanear
              </button>
            </form>
          </div>

          {/* Categorías Slider/Tags */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaActiva(cat)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  categoriaActiva === cat
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                    : 'bg-zinc-950/40 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Estado Informativo de Errores y Exitos */}
          {(errorMsg || successMsg) && (
            <div className={`p-3 rounded-xl border text-xs font-semibold ${
              errorMsg 
                ? 'bg-red-950/20 border-red-500/20 text-red-300' 
                : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
            }`}>
              {errorMsg || successMsg}
            </div>
          )}

          {/* Catálogo Grid */}
          {productosFiltrados.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <p className="text-xs font-semibold text-zinc-400">No se encontraron productos en el inventario.</p>
              <p className="text-[10px] text-zinc-500 mt-1">Crea productos en el apartado de Inventario o verifica la sede.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {productosFiltrados.map((p) => {
                const isLowStock = p.stock_actual <= p.stock_minimo;
                const isOutOfStock = p.stock_actual <= 0;
                
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={isOutOfStock}
                    className={`glass-card rounded-xl p-4 text-left border flex flex-col justify-between h-36 transition-all ${
                      isOutOfStock
                        ? 'opacity-40 cursor-not-allowed border-white/5'
                        : 'hover:border-amber-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase truncate max-w-[100px]">
                          {p.categoria}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-red-500 text-black'
                            : isLowStock
                              ? 'bg-red-500/10 text-red-400 border border-red-500/25'
                              : 'bg-zinc-900 text-zinc-400'
                        }`}>
                          {isOutOfStock ? 'AGOTADO' : `STOCK: ${p.stock_actual}`}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-1.5 line-clamp-2 leading-tight">
                        {p.nombre}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 w-full">
                      <p className="text-sm font-extrabold text-amber-500">
                        ${p.precio_venta.toLocaleString('es-CO')}
                      </p>
                      <span className="h-6 w-6 rounded-lg bg-amber-500/10 hover:bg-amber-500 hover:text-black flex items-center justify-center text-amber-400 transition-all">
                        +
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* LADO DERECHO: Carrito de Compras y Cobro (1 Columna) */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-5 border border-white/5 flex flex-col h-[calc(100vh-140px)] sticky top-[80px]">
          
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-amber-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Carrito de Ventas
            </h3>
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="text-[9px] font-bold text-red-400 hover:text-red-300 disabled:opacity-30 disabled:pointer-events-none"
            >
              Vaciar
            </button>
          </div>

          {/* Listado de items en el carrito */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 text-zinc-600 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                <p className="text-[10px] font-semibold text-zinc-500">Agrega productos al darles clic</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.producto.id} className="p-2.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-2">
                  <div className="truncate flex-1">
                    <p className="text-[11px] font-bold text-white truncate">{item.producto.nombre}</p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">${item.producto.precio_venta.toLocaleString('es-CO')} c/u</p>
                  </div>
                  
                  {/* Selector Cantidad */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateCantidad(item.producto.id, -1)}
                      className="h-5 w-5 rounded bg-zinc-900 border border-white/10 flex items-center justify-center text-xs font-bold text-zinc-300 hover:text-white"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-bold text-white w-4 text-center">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => updateCantidad(item.producto.id, 1)}
                      className="h-5 w-5 rounded bg-zinc-900 border border-white/10 flex items-center justify-center text-xs font-bold text-zinc-300 hover:text-white"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.producto.id)}
                      className="h-5 w-5 ml-1 flex items-center justify-center text-red-500 hover:text-red-400"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3a.75.75 0 000 1.5h1v10A2.25 2.25 0 006.25 17.75h7.5A2.25 2.25 0 0016 15.5v-10h1a.75.75 0 000-1.5h-3v-.25A2.75 2.75 0 0011.25 1h-2.5zM8 4h4v-.25a1.25 1.25 0 00-1.25-1.25h-2.5A1.25 1.25 0 008 3.75V4zM5.5 5.5h9v10a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-10z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario e Info de Venta */}
          <div className="space-y-3 pt-3 border-t border-white/5">
            {/* Input Quién Atiende */}
            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                ¿Quién Atiende? (Requerido)
              </label>
              <input
                type="text"
                required
                value={atendidoPor}
                onChange={(e) => setAtendidoPor(e.target.value)}
                placeholder="Nombre del cajero/mesero"
                className="w-full h-8 px-2.5 rounded-lg glass-input text-[11px] text-white"
              />
            </div>

            {/* Input Cliente */}
            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                Cliente (Opcional)
              </label>
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full h-8 px-2.5 rounded-lg glass-input text-[11px] text-white"
              />
            </div>

            {/* Fila: Descuento & Método Pago */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Descuento ($)
                </label>
                <input
                  type="number"
                  value={descuento || ''}
                  onChange={(e) => setDescuento(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full h-8 px-2 rounded-lg glass-input text-[11px] text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Método Pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e: any) => setMetodoPago(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-[#0a0a0c] border border-white/10 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CREDITO">Crédito (Fiar)</option>
                </select>
              </div>
            </div>

            {/* Detalle de Cuentas */}
            <div className="p-3 bg-black/60 rounded-xl border border-white/5 space-y-1.5 mt-2">
              <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
                <span>Subtotal Barra</span>
                <span>${subtotal.toLocaleString('es-CO')}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-[10px] text-red-400 font-semibold animate-fade-in">
                  <span>Descuento</span>
                  <span>-${descuento.toLocaleString('es-CO')}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-black text-white pt-1.5 border-t border-white/5">
                <span className="uppercase tracking-wide text-amber-500">Total a Cobrar</span>
                <span className="text-amber-500 font-extrabold">${total.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full h-10 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 mt-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4.13-5.69z" clipRule="evenodd" />
              </svg>
              Facturar Venta
            </button>
          </div>

        </div>

      </div>
      )}

      {/* VISTA HISTORIAL */}
      {activeTab === 'HISTORIAL' && (
        <div className="glass-card rounded-2xl p-6 border border-white/5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/5 mb-4 gap-3">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Historial de Ventas</h2>
              <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">Visualización del registro de caja</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Selector de Agrupación */}
              <div className="flex bg-black/50 border border-white/5 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setGroupByDay(false)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${!groupByDay ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                >
                  Por Transacción
                </button>
                <button
                  type="button"
                  onClick={() => setGroupByDay(true)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${groupByDay ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                >
                  Resumen por Día
                </button>
              </div>

              <span className="text-[10px] bg-zinc-900 border border-white/10 text-zinc-400 py-1 px-3 rounded-lg font-bold">
                {groupByDay ? ventasAgrupadasPorDia.length + ' Días' : ventas.length + ' Transacciones'}
              </span>
            </div>
          </div>

          {(errorMsg || successMsg) && (
            <div className={`p-3 rounded-xl border text-xs font-semibold mb-4 ${
              errorMsg 
                ? 'bg-red-950/20 border-red-500/20 text-red-300' 
                : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
            }`}>
              {errorMsg || successMsg}
            </div>
          )}

          <div className="overflow-x-auto">
            {groupByDay ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Transacciones</th>
                    <th className="p-3">Detalle Medios de Pago</th>
                    <th className="p-3 text-right">Recaudo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {ventasAgrupadasPorDia.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-zinc-500 font-semibold">
                        No hay ventas completadas registradas en esta sede.
                      </td>
                    </tr>
                  ) : (
                    ventasAgrupadasPorDia.map(grupo => (
                      <tr key={grupo.fecha} className="transition-all hover:bg-white/2">
                        <td className="p-3 font-bold text-white font-mono">{grupo.fecha}</td>
                        <td className="p-3 text-zinc-400 font-bold">{grupo.cantVentas} trans.</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2 text-[10.5px] font-medium">
                            {grupo.efectivo > 0 && (
                              <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                                💵 Efectivo: ${grupo.efectivo.toLocaleString('es-CO')}
                              </span>
                            )}
                            {grupo.tarjeta > 0 && (
                              <span className="bg-blue-950/20 text-blue-400 border border-blue-500/10 px-1.5 py-0.5 rounded">
                                💳 Tarjeta: ${grupo.tarjeta.toLocaleString('es-CO')}
                              </span>
                            )}
                            {grupo.transferencia > 0 && (
                              <span className="bg-purple-950/20 text-purple-400 border border-purple-500/10 px-1.5 py-0.5 rounded">
                                📱 Transf: ${grupo.transferencia.toLocaleString('es-CO')}
                              </span>
                            )}
                            {grupo.credito > 0 && (
                              <span className="bg-amber-950/20 text-amber-400 border border-amber-500/10 px-1.5 py-0.5 rounded">
                                📝 Crédito: ${grupo.credito.toLocaleString('es-CO')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right font-black text-lg text-emerald-400">
                          ${grupo.total.toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                    <th className="p-3">ID / Fecha</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Atendido Por</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                {ventas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-zinc-500 font-semibold">
                      No hay ventas registradas en esta sede.
                    </td>
                  </tr>
                ) : (
                  ventas.map(venta => (
                    <tr key={venta.id} className={`transition-all hover:bg-white/2 ${venta.estado === 'ANULADA' ? 'opacity-50' : ''}`}>
                      <td className="p-3">
                        <div className="font-mono text-zinc-300">#{venta.id.slice(0, 8)}</div>
                        <div className="text-[9px] text-zinc-500 mt-1">{new Date(venta.fecha_hora).toLocaleString('es-CO')}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-white">{venta.cliente_nombre || 'Cliente General'}</span>
                      </td>
                      <td className="p-3 text-zinc-400">{venta.atendido_por}</td>
                      <td className="p-3 font-bold text-amber-500">
                        ${venta.total.toLocaleString('es-CO')}
                      </td>
                      <td className="p-3">
                        {venta.estado === 'ANULADA' ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-block px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/20 rounded text-[9px] font-black uppercase max-w-fit">
                              ANULADA
                            </span>
                            <span className="text-[9px] text-red-400/70" title={venta.razon_anulacion}>
                              {venta.razon_anulacion}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-black uppercase">
                            COMPLETADA
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setCompletedVenta(venta)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                          title="Ver Ticket"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {venta.estado !== 'ANULADA' && (
                          <button
                            onClick={() => handleAnularVenta(venta.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 font-bold transition-all"
                            title="Anular Venta"
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">¡Venta Registrada Exitosamente!</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Ticket #{completedVenta.id}</p>
            </div>

            {/* Simulated 80mm ticket preview inside our premium UI */}
            <div className="bg-white text-black p-4 rounded-xl font-mono text-[10.5px] border border-zinc-200 shadow-inner max-h-64 overflow-y-auto mb-4">
              <div className="text-center font-bold mb-2">
                <p className="text-xs tracking-wider uppercase">
                  {sedes.find(s => s.id === completedVenta.sede_id)?.nombre || 'NexuS BAR'}
                </p>
                {sedes.find(s => s.id === completedVenta.sede_id)?.rut ? (
                  <p className="text-[8px]">RUT: {sedes.find(s => s.id === completedVenta.sede_id)?.rut}</p>
                ) : (
                  <p className="text-[8px]">SERVICIOS DE BAR Y COCTELERÍA</p>
                )}
                {sedes.find(s => s.id === completedVenta.sede_id)?.direccion && (
                  <p className="text-[7.5px] font-normal mt-0.5">
                    Dir: {sedes.find(s => s.id === completedVenta.sede_id)?.direccion}
                  </p>
                )}
              </div>
              <div className="border-t border-dashed border-black my-1"></div>
              <p className="text-[9px]">Fecha: {new Date(completedVenta.fecha_hora).toLocaleString('es-CO')}</p>
              <p className="text-[9px]">Atendió: {completedVenta.atendido_por}</p>
              <p className="text-[9px]">Cliente: {completedVenta.cliente_nombre || 'Cliente General'}</p>
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
              {completedVenta.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0) > completedVenta.total && (
                <div className="flex justify-between text-red-700">
                  <span>Descuento:</span>
                  <span>-${(Math.max(0, completedVenta.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0) - completedVenta.total)).toLocaleString('es-CO')}</span>
                </div>
              )}
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
                  printThermalReceipt(completedVenta);
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
                }}
                className="py-2.5 px-4 rounded-xl bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
