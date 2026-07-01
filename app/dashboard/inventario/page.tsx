'use client';

import { useState, useEffect } from 'react';
import { mockDb, Producto, Movimiento, Insumo, RecetaItem } from '@/lib/supabaseClient';

export default function InventarioPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'insumos' | 'movimientos' | 'categorias'>('stock');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODOS');
  const [tipoMovFiltro, setTipoMovFiltro] = useState('TODOS');

  // Modal para agregar/editar producto
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProd, setSelectedProd] = useState<Producto | null>(null);
  
  // Formulario Producto
  const [nombre, setNombre] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [categoria, setCategoria] = useState('Cervezas');
  const [precioCompra, setPrecioCompra] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [stockActual, setStockActual] = useState(0);
  const [stockMinimo, setStockMinimo] = useState(5);
  const [tieneReceta, setTieneReceta] = useState(false);
  const [receta, setReceta] = useState<RecetaItem[]>([]);
  const [registradoPor, setRegistradoPor] = useState('');

  // Modal Insumos
  const [showInsumoModal, setShowInsumoModal] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [insNombre, setInsNombre] = useState('');
  const [insUnidad, setInsUnidad] = useState('g');
  const [insStock, setInsStock] = useState(0);
  const [insMinimo, setInsMinimo] = useState(5);
  const [insCosto, setInsCosto] = useState(0);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Formulario Nueva Categoría
  const [nuevaCatNombre, setNuevaCatNombre] = useState('');
  const [catErrorMsg, setCatErrorMsg] = useState('');
  const [catSuccessMsg, setCatSuccessMsg] = useState('');

  // Creación rápida inline
  const [isCreatingCategoryInline, setIsCreatingCategoryInline] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');

  const loadSedeData = () => {
    const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
    setActiveSedeId(currentSedeId);
    setProductos(mockDb.getProductos(currentSedeId));
    setInsumos(mockDb.getInsumos(currentSedeId));
    setMovimientos(mockDb.getMovimientos(currentSedeId));
    setCategorias(mockDb.getCategorias());
  };

  useEffect(() => {
    loadSedeData();

    // Comprobar parámetro de pestaña en la URL de forma segura en el cliente
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'movimientos') {
        setActiveTab('movimientos');
      }
    }

    const handleSedeChange = () => {
      loadSedeData();
      closeModal();
      closeInsumoModal();
    };
    const handleCloudSync = () => { loadSedeData(); };
    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);
    return () => { window.removeEventListener('sedeChanged', handleSedeChange); window.removeEventListener('cloudSync', handleCloudSync); };
  }, []);

  const closeModal = () => {
    setShowProductModal(false);
    setSelectedProd(null);
    setNombre('');
    setCodigoBarras('');
    setCategoria(categorias[0] || 'Varios');
    setPrecioCompra(0);
    setPrecioVenta(0);
    setStockActual(0);
    setStockMinimo(5);
    setTieneReceta(false);
    setReceta([]);
    setRegistradoPor('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsCreatingCategoryInline(false);
    setInlineCategoryName('');
  };

  const closeInsumoModal = () => {
    setShowInsumoModal(false);
    setSelectedInsumo(null);
    setInsNombre('');
    setInsUnidad('g');
    setInsStock(0);
    setInsMinimo(5);
    setInsCosto(0);
    setErrorMsg('');
  };

  const handleAddProductClick = () => {
    setSelectedProd(null);
    setCategoria(categorias[0] || 'Varios');
    setTieneReceta(false);
    setReceta([]);
    setShowProductModal(true);
  };

  const handleEditProductClick = (prod: Producto) => {
    setSelectedProd(prod);
    setNombre(prod.nombre);
    setCodigoBarras(prod.codigo_barras);
    setCategoria(prod.categoria);
    setPrecioCompra(prod.precio_compra);
    setPrecioVenta(prod.precio_venta);
    setStockActual(prod.stock_actual);
    setStockMinimo(prod.stock_minimo);
    setTieneReceta(prod.tiene_receta || false);
    setReceta(prod.receta || []);
    setShowProductModal(true);
    setIsCreatingCategoryInline(false);
    setInlineCategoryName('');
  };

  const handleAddInsumoClick = () => {
    setSelectedInsumo(null);
    setShowInsumoModal(true);
  };

  const handleEditInsumoClick = (ins: Insumo) => {
    setSelectedInsumo(ins);
    setInsNombre(ins.nombre);
    setInsUnidad(ins.unidad);
    setInsStock(ins.stock_actual);
    setInsMinimo(ins.stock_minimo);
    setInsCosto(ins.costo_unitario);
    setShowInsumoModal(true);
  };

  const handleDeleteProductClick = (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el producto "${name}"? Esta acción no se puede deshacer.`)) return;
    
    let sessionUser = 'Administrador';
    try {
      const sessionStr = localStorage.getItem('alico_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        sessionUser = session.nombre || 'Administrador';
      }
    } catch (e) {}

    mockDb.deleteProducto(id, sessionUser);
    setSuccessMsg('Producto eliminado con éxito.');
    loadSedeData();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeleteInsumoClick = (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el insumo "${name}"? Esta acción no se puede deshacer.`)) return;
    
    let sessionUser = 'Administrador';
    try {
      const sessionStr = localStorage.getItem('alico_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        sessionUser = session.nombre || 'Administrador';
      }
    } catch (e) {}

    mockDb.deleteInsumo(id, sessionUser);
    setSuccessMsg('Insumo eliminado con éxito.');
    loadSedeData();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatErrorMsg('');
    setCatSuccessMsg('');

    const clean = nuevaCatNombre.trim();
    if (!clean) {
      setCatErrorMsg('Por favor escribe un nombre de categoría válido.');
      return;
    }

    if (categorias.some(c => c.toLowerCase() === clean.toLowerCase())) {
      setCatErrorMsg('Esta categoría ya se encuentra registrada.');
      return;
    }

    try {
      mockDb.addCategoria(clean);
      setCatSuccessMsg(`¡Categoría "${clean}" creada con éxito!`);
      setNuevaCatNombre('');
      loadSedeData();
      window.dispatchEvent(new Event('sedeChanged'));
      setTimeout(() => setCatSuccessMsg(''), 3000);
    } catch (err) {
      setCatErrorMsg('Error al agregar la categoría.');
    }
  };

  const handleDeleteCategory = (catName: string) => {
    const count = productos.filter(p => p.categoria.toLowerCase() === catName.toLowerCase()).length;
    if (count > 0) {
      alert('No puedes eliminar esta categoría porque contiene productos activos.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la categoría "${catName}"?`)) return;

    try {
      mockDb.deleteCategoria(catName);
      setCatSuccessMsg('Categoría eliminada con éxito.');
      loadSedeData();
      window.dispatchEvent(new Event('sedeChanged'));
      setTimeout(() => setCatSuccessMsg(''), 2000);
    } catch (err) {
      setCatErrorMsg('Error al eliminar la categoría.');
    }
  };

  const handleSaveCategoryInline = () => {
    const clean = inlineCategoryName.trim();
    if (!clean) return;

    if (categorias.some(c => c.toLowerCase() === clean.toLowerCase())) {
      setCategoria(categorias.find(c => c.toLowerCase() === clean.toLowerCase()) || clean);
      setIsCreatingCategoryInline(false);
      setInlineCategoryName('');
      return;
    }

    try {
      mockDb.addCategoria(clean);
      const updatedCats = mockDb.getCategorias();
      setCategorias(updatedCats);
      setCategoria(clean);
      setIsCreatingCategoryInline(false);
      setInlineCategoryName('');
      window.dispatchEvent(new Event('sedeChanged'));
    } catch (err) {
      console.error('Error al agregar categoría inline', err);
    }
  };

  const submitProductForm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!nombre.trim() || !registradoPor.trim()) {
      setErrorMsg('Por favor rellena todos los campos obligatorios para auditoría.');
      return;
    }

    if (tieneReceta && receta.length === 0) {
      setErrorMsg('Si el producto tiene receta, debes añadir al menos un insumo.');
      return;
    }

    try {
      mockDb.saveProducto({
        id: selectedProd?.id,
        sede_id: activeSedeId,
        nombre: nombre,
        codigo_barras: codigoBarras || 'SIN-CODIGO',
        categoria: categoria,
        precio_compra: tieneReceta ? 0 : precioCompra,
        precio_venta: precioVenta,
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
        registrado_por: registradoPor,
        tiene_receta: tieneReceta,
        receta: tieneReceta ? receta : []
      });

      setSuccessMsg(selectedProd ? '¡Producto actualizado con éxito!' : '¡Producto creado y auditado con éxito!');
      loadSedeData();
      window.dispatchEvent(new Event('sedeChanged'));
      setTimeout(() => closeModal(), 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el formulario.');
    }
  };

  const submitInsumoForm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!insNombre.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    try {
      mockDb.saveInsumo({
        id: selectedInsumo?.id,
        sede_id: activeSedeId,
        nombre: insNombre,
        unidad: insUnidad,
        stock_actual: insStock,
        stock_minimo: insMinimo,
        costo_unitario: insCosto
      });

      setSuccessMsg('¡Insumo guardado con éxito!');
      loadSedeData();
      window.dispatchEvent(new Event('sedeChanged'));
      setTimeout(() => closeInsumoModal(), 600);
    } catch (err: any) {
      setErrorMsg('Error al guardar insumo.');
    }
  };

  // Agregar ingrediente a la receta actual
  const handleAddRecetaItem = () => {
    if (insumos.length === 0) return;
    const available = insumos.find(i => !receta.find(r => r.insumo_id === i.id));
    if (!available) {
      alert('Ya has añadido todos los insumos disponibles a esta receta.');
      return;
    }
    setReceta([...receta, { insumo_id: available.id, insumo_nombre: available.nombre, cantidad: 1, unidad: available.unidad }]);
  };

  // Categorías únicas
  const categoriasUnicas = ['TODOS', ...categorias];

  // Filtrado de Productos
  const productosFiltrados = productos.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                          p.codigo_barras.includes(busqueda);
    const matchesCategory = categoriaFiltro === 'TODOS' || p.categoria === categoriaFiltro;
    return matchesSearch && matchesCategory;
  });

  // Filtrado de Insumos
  const insumosFiltrados = insumos.filter(i => {
    return i.nombre.toLowerCase().includes(busqueda.toLowerCase());
  });

  // Filtrado de Movimientos
  const movimientosFiltrados = movimientos.filter(m => {
    const matchesSearch = m.producto_nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                          m.registrado_por.toLowerCase().includes(busqueda.toLowerCase());
    const matchesType = tipoMovFiltro === 'TODOS' || m.tipo === tipoMovFiltro;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Inventario & Cocina</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Administra existencias, recetas, insumos y auditoría de bodega.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'insumos' ? (
            <button
              onClick={handleAddInsumoClick}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
            >
              + Añadir Insumo
            </button>
          ) : activeTab === 'stock' ? (
            <button
              onClick={handleAddProductClick}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
            >
              + Añadir Producto Final
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabs de Selección */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => { setActiveTab('stock'); setBusqueda(''); }}
          className={`py-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'stock'
              ? 'border-amber-500 text-amber-500 font-extrabold'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Catálogo Productos Finales
        </button>
        <button
          onClick={() => { setActiveTab('insumos'); setBusqueda(''); }}
          className={`py-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'insumos'
              ? 'border-emerald-500 text-emerald-500 font-extrabold'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Insumos de Cocina (Recetas)
        </button>
        <button
          onClick={() => { setActiveTab('movimientos'); setBusqueda(''); }}
          className={`py-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'movimientos'
              ? 'border-amber-500 text-amber-500 font-extrabold'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Auditoría de Movimientos
        </button>
        <button
          onClick={() => { setActiveTab('categorias'); setBusqueda(''); }}
          className={`py-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'categorias'
              ? 'border-amber-500 text-amber-500 font-extrabold'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Categorías
        </button>
      </div>

      {/* Filtros rápidos y Barra de Búsqueda */}
      {activeTab !== 'categorias' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="relative sm:col-span-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs text-white"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
              </svg>
            </div>
          </div>

          <div>
            {activeTab === 'stock' ? (
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#0a0a0c] border border-white/10 text-xs text-white cursor-pointer"
              >
                <option value="TODOS">Categoría: Todas</option>
                {categoriasUnicas.filter(c => c !== 'TODOS').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : activeTab === 'movimientos' ? (
              <select
                value={tipoMovFiltro}
                onChange={(e) => setTipoMovFiltro(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#0a0a0c] border border-white/10 text-xs text-white cursor-pointer"
              >
                <option value="TODOS">Tipo Movimiento: Todos</option>
                <option value="INGRESO">Ingresos (Abastecimientos)</option>
                <option value="EGRESO">Egresos (Ventas / Bajas)</option>
              </select>
            ) : null}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* Contenido según la Tab */}
      {activeTab === 'categorias' ? (
        /* GESTIÓN DE CATEGORÍAS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Listado de Categorías */}
          <div className="lg:col-span-2 glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-amber-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.5 1.5 0 002.122 0l4.318-4.318a1.5 1.5 0 000-2.122L10.099 4.659A2.25 2.25 0 008.682 3h-.514z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h.007v.008H6V7.5z" />
                </svg>
                Gestión de Categorías
              </h3>
              <span className="text-[10px] font-bold bg-zinc-900 border border-white/10 text-zinc-400 py-1 px-3 rounded-xl">
                {categorias.length} {categorias.length === 1 ? 'Categoría' : 'Categorías'}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/5">
              {categorias.map(cat => {
                const count = productos.filter(p => p.categoria.toLowerCase() === cat.toLowerCase()).length;
                const canDelete = count === 0;

                return (
                  <div key={cat} className="group p-4 bg-zinc-950/40 border border-white/5 rounded-2xl flex items-center justify-between gap-3 hover:border-amber-500/25 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/0 via-amber-500/0 to-amber-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <div className="flex items-center gap-3 truncate">
                      <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-amber-500 transition-colors flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.5 1.5 0 002.122 0l4.318-4.318a1.5 1.5 0 000-2.122L10.099 4.659A2.25 2.25 0 008.682 3h-.514z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h.007v.008H6V7.5z" />
                        </svg>
                      </div>

                      <div className="truncate">
                        <h4 className="text-xs font-black text-white truncate max-w-[130px] tracking-wide">{cat}</h4>
                        
                        <div className="flex items-center gap-1.5 mt-1">
                          {count > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wide bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              En Uso ({count} {count === 1 ? 'Prod' : 'Prods'})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wide bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              Vacía
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      disabled={!canDelete}
                      title={canDelete ? "Eliminar Categoría" : "No puedes eliminar una categoría en uso con productos activos"}
                      className={`p-2 rounded-xl transition-all cursor-pointer border ${
                        canDelete
                          ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black hover:border-red-500 shadow-sm hover:shadow-red-500/20'
                          : 'bg-zinc-900/40 border-white/5 text-zinc-600 cursor-not-allowed opacity-35'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Formulario Nueva Categoría */}
          <div className="lg:col-span-1 glass-card rounded-2xl border border-white/5 p-5 h-fit relative overflow-hidden bg-black/10">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5 mb-4">
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Nueva Categoría</h3>
            </div>

            {catErrorMsg && (
              <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/20 text-red-300 text-[10px] font-bold mb-3 animate-fade-in">
                {catErrorMsg}
              </div>
            )}
            {catSuccessMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold mb-3 animate-fade-in">
                {catSuccessMsg}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 px-0.5">
                  Nombre de la Categoría
                </label>
                <input
                  type="text"
                  required
                  value={nuevaCatNombre}
                  onChange={(e) => setNuevaCatNombre(e.target.value)}
                  placeholder="Ej. Bebidas Calientes"
                  className="w-full h-10 px-3 rounded-xl glass-input text-xs text-white focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <button 
                type="submit" 
                className="w-full h-10 rounded-xl btn-gold text-xs font-bold shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Registrar Categoría
              </button>
            </form>
          </div>
        </div>
      ) : activeTab === 'insumos' ? (
        /* INSUMOS (COCINA) */
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-emerald-950/20 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  <th className="py-3.5 px-4">Nombre Insumo</th>
                  <th className="py-3.5 px-4">Unidad</th>
                  <th className="py-3.5 px-4 text-right">Costo Und.</th>
                  <th className="py-3.5 px-4 text-center">Stock Actual</th>
                  <th className="py-3.5 px-4 text-center">Mínimo</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                {insumosFiltrados.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-zinc-500">No hay insumos registrados.</td></tr>
                ) : (
                  insumosFiltrados.map(i => {
                    const isLowInsumo = i.stock_actual <= i.stock_minimo;
                    const isOutInsumo = i.stock_actual <= 0;
                    return (
                    <tr key={i.id} className="hover:bg-white/2">
                      <td className="py-3 px-4 text-white font-semibold">{i.nombre}</td>
                      <td className="py-3 px-4"><span className="bg-emerald-900 border border-emerald-500/20 text-emerald-300 text-[9px] font-bold py-0.5 px-2 rounded-md">{i.unidad}</span></td>
                      <td className="py-3 px-4 text-right font-medium">${i.costo_unitario.toLocaleString('es-CO')}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-black text-xs py-0.5 px-2.5 rounded-md ${
                          isOutInsumo ? 'bg-red-500 text-black font-extrabold' : isLowInsumo ? 'bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse' : 'text-emerald-400'
                        }`}>
                          {i.stock_actual}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-zinc-500">{i.stock_minimo}</td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => handleEditInsumoClick(i)} className="p-1.5 rounded-lg bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer mx-1">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.155 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10a.75.75 0 000-1.5H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteInsumoClick(i.id, i.nombre)} className="p-1.5 rounded-lg bg-red-950/20 border border-red-500/10 hover:bg-red-900/30 text-red-400 hover:text-red-300 cursor-pointer mx-1">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3a.75.75 0 000 1.5h1v10A2.25 2.25 0 006.25 17.75h7.5A2.25 2.25 0 0016 15.5v-10h1a.75.75 0 000-1.5h-3v-.25A2.75 2.75 0 0011.25 1h-2.5zM8 4h4v-.25a1.25 1.25 0 00-1.25-1.25h-2.5A1.25 1.25 0 008 3.75V4zM5.5 5.5h9v10a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-10z" clipRule="evenodd" /></svg>
                        </button>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'stock' ? (
        /* PRODUCTOS FINALES */
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/40 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Categoría</th>
                  <th className="py-3.5 px-4">Producto</th>
                  <th className="py-3.5 px-4 text-right">P. Venta</th>
                  <th className="py-3.5 px-4 text-center">Tipo / Stock</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                {productosFiltrados.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-zinc-500">No hay productos.</td></tr>
                ) : (
                  productosFiltrados.map((p) => {
                    const isLowStock = p.stock_actual <= p.stock_minimo;
                    const isOutOfStock = p.stock_actual <= 0;

                    return (
                      <tr key={p.id} className="hover:bg-white/2 transition-colors">
                        <td className="py-3 px-4 font-mono text-[10px] text-zinc-500">{p.codigo_barras}</td>
                        <td className="py-3 px-4">
                          <span className="bg-zinc-900 border border-white/5 text-zinc-400 text-[9px] font-bold py-0.5 px-2 rounded-md">
                            {p.categoria}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-semibold flex items-center gap-2">
                          {p.nombre}
                          {p.tiene_receta && <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1.5 py-0.5 rounded border border-amber-500/20">COMIDA</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-500">${p.precio_venta.toLocaleString('es-CO')}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-black text-xs py-0.5 px-2.5 rounded-md ${
                            isOutOfStock ? 'bg-red-500 text-black font-extrabold' : isLowStock ? 'bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse' : 'text-emerald-400'
                          }`}>
                            {p.stock_actual} U.
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => handleEditProductClick(p)} className="p-1.5 rounded-lg bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer mx-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.155 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10a.75.75 0 000-1.5H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteProductClick(p.id, p.nombre)} className="p-1.5 rounded-lg bg-red-950/20 border border-red-500/10 hover:bg-red-900/30 text-red-400 hover:text-red-300 cursor-pointer mx-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3a.75.75 0 000 1.5h1v10A2.25 2.25 0 006.25 17.75h7.5A2.25 2.25 0 0016 15.5v-10h1a.75.75 0 000-1.5h-3v-.25A2.75 2.75 0 0011.25 1h-2.5zM8 4h4v-.25a1.25 1.25 0 00-1.25-1.25h-2.5A1.25 1.25 0 008 3.75V4zM5.5 5.5h9v10a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-10z" clipRule="evenodd" /></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MOVIMIENTOS */
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-black/40 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-center">Cant</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {movimientosFiltrados.map(m => (
                <tr key={m.id}>
                  <td className="py-2 px-4">{new Date(m.fecha_hora).toLocaleString('es-CO')}</td>
                  <td className="py-2 px-4 font-bold">{m.producto_nombre}</td>
                  <td className="py-2 px-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] ${m.tipo==='INGRESO'?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400'}`}>{m.tipo}</span>
                  </td>
                  <td className="py-2 px-4 text-center font-bold">{m.cantidad}</td>
                  <td className="py-2 px-4">{m.motivo}</td>
                  <td className="py-2 px-4">{m.registrado_por}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: PRODUCTOS Y RECETAS */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40 overflow-y-auto pt-20">
          <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-lg w-full relative">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              {selectedProd ? `Editar: ${selectedProd.nombre}` : 'Registrar Nuevo Producto'}
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={submitProductForm} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Nombre</label>
                <input type="text" required value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Código de Barras</label>
                  <input type="text" value={codigoBarras} onChange={e=>setCodigoBarras(e.target.value)} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Categoría</label>
                  <select value={categoria} onChange={e=>setCategoria(e.target.value)} className="w-full h-9 px-2 rounded-lg bg-[#0a0a0c] border border-white/10 text-xs text-white cursor-pointer">
                    {categorias.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Toggle Receta */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center gap-3">
                <input type="checkbox" id="tiene_receta" checked={tieneReceta} onChange={e => setTieneReceta(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                <label htmlFor="tiene_receta" className="text-xs font-bold text-amber-500 cursor-pointer">
                  Este producto es una Comida / Tiene Receta
                </label>
              </div>

              {tieneReceta && (
                /* Constructor de Recetas */
                <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Ingredientes de la Receta</h4>
                    <button type="button" onClick={handleAddRecetaItem} className="text-[9px] px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 font-bold">+ Agregar Insumo</button>
                  </div>
                  
                  {receta.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 italic">No has agregado ingredientes. Agrega la carne, pan, etc.</p>
                  ) : (
                    <div className="space-y-2">
                      {receta.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select 
                            value={item.insumo_id} 
                            onChange={(e) => {
                              const nuevoInsumo = insumos.find(i => i.id === e.target.value);
                              if (!nuevoInsumo) return;
                              const nReceta = [...receta];
                              nReceta[idx] = { ...nReceta[idx], insumo_id: nuevoInsumo.id, insumo_nombre: nuevoInsumo.nombre, unidad: nuevoInsumo.unidad };
                              setReceta(nReceta);
                            }}
                            className="flex-1 h-8 px-2 text-xs bg-zinc-900 border border-white/10 rounded text-white"
                          >
                            {insumos.map(ins => <option key={ins.id} value={ins.id}>{ins.nombre} ({ins.unidad})</option>)}
                          </select>
                          <input 
                            type="number" min="0.1" step="any"
                            value={item.cantidad} 
                            onChange={e => {
                              const nReceta = [...receta];
                              nReceta[idx].cantidad = Number(e.target.value);
                              setReceta(nReceta);
                            }}
                            className="w-16 h-8 text-center text-xs bg-zinc-900 border border-white/10 rounded text-white"
                          />
                          <span className="text-[10px] text-zinc-500">{item.unidad}</span>
                          <button type="button" onClick={() => {
                            const nReceta = receta.filter((_, i) => i !== idx);
                            setReceta(nReceta);
                          }} className="text-red-400 px-2 h-8">X</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {!tieneReceta ? (
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Precio Compra</label>
                    <input type="number" min="0" value={precioCompra} onChange={e=>setPrecioCompra(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Costo Estimado (Suma Insumos)</label>
                    <div className="w-full h-9 px-3 py-2 rounded-lg bg-zinc-950/80 border border-white/5 text-xs text-zinc-400 font-semibold font-mono flex items-center">
                      ${receta.reduce((sum, item) => {
                        const ins = insumos.find(i => i.id === item.insumo_id);
                        return sum + (ins ? ins.costo_unitario * item.cantidad : 0);
                      }, 0).toLocaleString('es-CO')}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Stock Disponible</label>
                  <input type="number" min="0" value={stockActual} onChange={e=>setStockActual(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Precio Venta al Público</label>
                  <input type="number" min="0" required value={precioVenta} onChange={e=>setPrecioVenta(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg glass-input text-xs font-bold text-amber-400" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Stock Mínimo</label>
                  <input type="number" min="0" required value={stockMinimo} onChange={e=>setStockMinimo(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Operador Responsable</label>
                <input type="text" required value={registradoPor} onChange={e=>setRegistradoPor(e.target.value)} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold">Cancelar</button>
                <button type="submit" className="flex-1 h-9 rounded-lg btn-gold text-xs font-bold">Guardar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSUMOS */}
      {showInsumoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
          <div className="glass-card rounded-2xl p-6 border border-emerald-500/20 max-w-sm w-full relative">
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              {selectedInsumo ? `Editar Insumo: ${selectedInsumo.nombre}` : 'Añadir Nuevo Insumo'}
            </h3>

            {errorMsg && <div className="p-2.5 bg-red-950/20 text-red-300 text-xs font-semibold mb-4 rounded">{errorMsg}</div>}

            <form onSubmit={submitInsumoForm} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Nombre Insumo</label>
                <input type="text" required value={insNombre} onChange={e=>setInsNombre(e.target.value)} placeholder="Ej. Carne Molida" className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Unidad de Medida</label>
                  <select value={insUnidad} onChange={e=>setInsUnidad(e.target.value)} className="w-full h-9 px-2 rounded-lg bg-[#0a0a0c] border border-white/10 text-xs text-white">
                    <option value="g">Gramos (g)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="und">Unidad (und)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Costo Unitario</label>
                  <input type="number" required min="0" step="0.01" value={insCosto} onChange={e=>setInsCosto(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Stock Actual</label>
                  <input type="number" required min="0" step="any" value={insStock} onChange={e=>setInsStock(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Stock Mínimo</label>
                  <input type="number" required min="0" step="any" value={insMinimo} onChange={e=>setInsMinimo(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeInsumoModal} className="flex-1 h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold">Cancelar</button>
                <button type="submit" className="flex-1 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold">Guardar Insumo</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
