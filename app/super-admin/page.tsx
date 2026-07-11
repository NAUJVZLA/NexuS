'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mockDb, Sede, Venta, Producto, CreditoCliente, CierreCaja, PrestamoBotella, getMockData, supabase, isMockMode, Negocio, Usuario } from '@/lib/supabaseClient';

export default function SuperAdminPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Formulario Crear Cliente SaaS
  const [newNegocioNombre, setNewNegocioNombre] = useState('');
  const [newNegocioSubdominio, setNewNegocioSubdominio] = useState('');
  const [newNegocioRut, setNewNegocioRut] = useState('');
  const [newNegocioDireccion, setNewNegocioDireccion] = useState('');
  const [newAdminNombre, setNewAdminNombre] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('admin123');

  // Formulario Editar Negocio (Cliente SaaS)
  const [editingNegocioId, setEditingNegocioId] = useState<string | null>(null);
  const [editNegocioNombre, setEditNegocioNombre] = useState('');
  const [editNegocioSubdominio, setEditNegocioSubdominio] = useState('');
  const [editNegocioRut, setEditNegocioRut] = useState('');
  const [editNegocioDireccion, setEditNegocioDireccion] = useState('');
  const [editNegocioPlanActivo, setEditNegocioPlanActivo] = useState('Básico');
  const [editNegocioEstadoSuscripcion, setEditNegocioEstadoSuscripcion] = useState<'ACTIVO' | 'SUSPENDIDO' | 'DEMO'>('ACTIVO');
  const [editNegocioFechaVencimiento, setEditNegocioFechaVencimiento] = useState('');

  // Administrador del Negocio en edición
  const [editAdminNombre, setEditAdminNombre] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');

  // Modal de Confirmación para Reseteo/Limpieza de Negocio (Cliente SaaS)
  const [showResetNegocioModal, setShowResetNegocioModal] = useState(false);
  const [negocioToReset, setNegocioToReset] = useState<Negocio | null>(null);
  const [negocioResetConfirmText, setNegocioResetConfirmText] = useState('');

  // Formulario cambio contraseñas
  const [updateAdminPassword, setUpdateAdminPassword] = useState('');
  const [newSuperPassword, setNewSuperPassword] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [creditos, setCreditos] = useState<CreditoCliente[]>([]);
  const [cierres, setCierreCaja] = useState<CierreCaja[]>([]); // Evitar colisión de nombre
  const [prestamos, setPrestamos] = useState<PrestamoBotella[]>([]);

  // Filtros y Pestañas para Depuración
  const [selectedSedeFilter, setSelectedSedeFilter] = useState<string>('TODAS');
  const [debugSearchTerm, setDebugSearchTerm] = useState('');
  const [activeDebugTab, setActiveDebugTab] = useState<'ventas' | 'creditos' | 'cierres' | 'prestamos'>('ventas');

  // Modal de Confirmación para Borrado Individual
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [typeToDelete, setTypeToDelete] = useState<'venta' | 'credito' | 'cierre' | 'prestamo' | null>(null);

  // Modal de Confirmación para Borrado de Negocio (Cliente SaaS)
  const [showDeleteNegocioModal, setShowDeleteNegocioModal] = useState(false);
  const [negocioToDelete, setNegocioToDelete] = useState<Negocio | null>(null);
  const [negocioDeleteConfirmText, setNegocioDeleteConfirmText] = useState('');

  useEffect(() => {
    // Guard de Sesión para Super Admin
    const sessionStr = localStorage.getItem('alico_session');
    if (!sessionStr) {
      router.replace('/login');
      return;
    }

    try {
      const session = JSON.parse(sessionStr);
      if (session.role !== 'super_admin') {
        router.replace('/login');
        return;
      }
      setUserName(session.nombre);
    } catch (e) {
      localStorage.removeItem('alico_session');
      router.replace('/login');
      return;
    }

    loadData();
  }, [router]);

  const loadData = () => {
    setSedes(mockDb.getSedes());
    setVentas(mockDb.getVentas());
    setProductos(mockDb.getProductos());
    setCreditos(mockDb.getCreditos());
    setCierreCaja(mockDb.getCierres());
    setPrestamos(mockDb.getPrestamos());
    setNegocios(mockDb.getNegocios());
    setUsuarios(mockDb.getUsuarios());
  };

  const handleOpenDeleteModal = (item: any, type: 'venta' | 'credito' | 'cierre' | 'prestamo') => {
    setItemToDelete(item);
    setTypeToDelete(type);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !typeToDelete) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const activeUser = userName || 'Super Admin';
      let res = false;
      if (typeToDelete === 'venta') {
        res = mockDb.eliminarVenta(itemToDelete.id, activeUser);
        if (res) setSuccessMsg('Venta eliminada con éxito (incluyendo su crédito asociado si existía).');
      } else if (typeToDelete === 'credito') {
        res = mockDb.eliminarCredito(itemToDelete.id, activeUser);
        if (res) setSuccessMsg('Crédito de cartera eliminado con éxito.');
      } else if (typeToDelete === 'cierre') {
        res = mockDb.eliminarCierre(itemToDelete.id, activeUser);
        if (res) setSuccessMsg('Arqueo de caja (cierre) eliminado con éxito.');
      } else if (typeToDelete === 'prestamo') {
        res = mockDb.eliminarPrestamo(itemToDelete.id, activeUser);
        if (res) setSuccessMsg('Registro de préstamo eliminado con éxito.');
      }

      if (res) {
        loadData();
        // Emitir cambio de sede global por seguridad
        window.dispatchEvent(new Event('sedeChanged'));
      } else {
        setErrorMsg('No se pudo eliminar el registro.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el registro.');
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
      setTypeToDelete(null);
    }
  };

  const handleConfirmDeleteNegocio = () => {
    if (!negocioToDelete) return;
    if (negocioDeleteConfirmText !== negocioToDelete.nombre) {
      setErrorMsg('El nombre ingresado no coincide con el nombre de la empresa.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = mockDb.deleteNegocio(negocioToDelete.id);
      if (res) {
        setSuccessMsg(`Cliente SaaS "${negocioToDelete.nombre}" y todos sus datos asociados fueron eliminados correctamente.`);
        loadData();
        window.dispatchEvent(new Event('sedeChanged'));
      } else {
        setErrorMsg('No se pudo eliminar el cliente.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el cliente.');
    } finally {
      setShowDeleteNegocioModal(false);
      setNegocioToDelete(null);
      setNegocioDeleteConfirmText('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alico_session');
    router.replace('/login');
  };

  // 1. CREAR NUEVO CLIENTE SAAS (Negocio + Sede + Admin)
  const handleCreateClienteSaaS = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanSubdominio = newNegocioSubdominio.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!newNegocioNombre.trim() || !cleanSubdominio || !newAdminNombre.trim() || !newAdminPassword.trim()) {
      setErrorMsg('Por favor completa todos los campos obligatorios del nuevo cliente.');
      return;
    }

    try {
      // Validar si ya existe el subdominio
      const allNegocios = mockDb.getNegocios();
      if (allNegocios.some(n => n.subdominio === cleanSubdominio)) {
        setErrorMsg('Este subdominio ya está registrado por otro establecimiento.');
        return;
      }

      // A. Registrar el Negocio
      const negocio = mockDb.addNegocio({
        nombre: newNegocioNombre.trim(),
        subdominio: cleanSubdominio,
        rut: newNegocioRut.trim(),
        direccion: newNegocioDireccion.trim()
      });

      // B. Registrar el Usuario Administrador de ese Negocio
      const generatedEmail = `admin@${cleanSubdominio}.com`;
      const usuario = mockDb.addUsuario({
        negocio_id: negocio.id,
        email: generatedEmail,
        nombre: newAdminNombre.trim(),
        password: newAdminPassword.trim(),
        rol: 'admin'
      });

      // C. Crear Sede Principal del Negocio
      const sede = mockDb.addSede({
        negocio_id: negocio.id,
        nombre: `Sede Principal - ${negocio.nombre}`,
        rut: negocio.rut,
        direccion: negocio.direccion
      });

      // D. Crear mesas por defecto para la nueva sede
      const allMesas = mockDb.getMesas();
      const defaultMesas = [
        { id: 'm-' + Date.now() + '-1', sede_id: sede.id, numero_mesa: 'Mesa 1', estado: 'DISPONIBLE' as const, cliente_nombre: '', consumos: [] },
        { id: 'm-' + Date.now() + '-2', sede_id: sede.id, numero_mesa: 'Mesa 2', estado: 'DISPONIBLE' as const, cliente_nombre: '', consumos: [] },
        { id: 'm-' + Date.now() + '-3', sede_id: sede.id, numero_mesa: 'Mesa 3', estado: 'DISPONIBLE' as const, cliente_nombre: '', consumos: [] },
        { id: 'm-' + Date.now() + '-4', sede_id: sede.id, numero_mesa: 'Barra Asientos', estado: 'DISPONIBLE' as const, cliente_nombre: '', consumos: [] }
      ];
      localStorage.setItem('alico_mesas', JSON.stringify([...allMesas, ...defaultMesas]));

      setSuccessMsg(`¡Cliente SaaS "${newNegocioNombre}" registrado con éxito! Acceso: ${generatedEmail}`);
      
      // Limpiar Formulario
      setNewNegocioNombre('');
      setNewNegocioSubdominio('');
      setNewNegocioRut('');
      setNewNegocioDireccion('');
      setNewAdminNombre('');
      setNewAdminEmail('');
      setNewAdminPassword('admin123');
      
      loadData();
      
      // Emitir cambio de sede global por seguridad
      window.dispatchEvent(new Event('sedeChanged'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el cliente SaaS.');
    }
  };

  const handleOpenEditNegocio = (negocio: Negocio) => {
    setEditingNegocioId(negocio.id);
    setEditNegocioNombre(negocio.nombre);
    setEditNegocioSubdominio(negocio.subdominio || '');
    setEditNegocioRut(negocio.rut || '');
    setEditNegocioDireccion(negocio.direccion || '');
    setEditNegocioPlanActivo(negocio.plan_activo || 'Básico');
    setEditNegocioEstadoSuscripcion(negocio.estado_suscripcion || 'ACTIVO');
    setEditNegocioFechaVencimiento(negocio.fecha_vencimiento || '');

    const adminUser = usuarios.find(u => u.negocio_id === negocio.id && u.rol === 'admin');
    if (adminUser) {
      setEditAdminNombre(adminUser.nombre);
      setEditAdminEmail(adminUser.email);
      setEditAdminPassword(adminUser.password || '');
    } else {
      setEditAdminNombre('');
      setEditAdminEmail('');
      setEditAdminPassword('');
    }
  };

  const handleSaveNegocioEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanSubdominio = editNegocioSubdominio.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!editingNegocioId || !editNegocioNombre.trim() || !cleanSubdominio) {
      setErrorMsg('El nombre y el subdominio de la empresa son requeridos.');
      return;
    }

    try {
      // Validar si ya existe el subdominio
      const currentNeg = negocios.find(n => n.id === editingNegocioId);
      if (currentNeg && currentNeg.subdominio !== cleanSubdominio) {
        if (negocios.some(n => n.subdominio === cleanSubdominio)) {
          setErrorMsg('Este subdominio ya está registrado por otro establecimiento.');
          return;
        }
      }

      const updated = mockDb.updateNegocio(editingNegocioId, {
        nombre: editNegocioNombre.trim(),
        subdominio: cleanSubdominio,
        rut: editNegocioRut.trim(),
        direccion: editNegocioDireccion.trim(),
        plan_activo: editNegocioPlanActivo,
        estado_suscripcion: editNegocioEstadoSuscripcion,
        fecha_vencimiento: editNegocioFechaVencimiento
      });

      if (updated) {
        // Forzar el correo del administrador: admin@subdominio.com
        const generatedEmail = `admin@${cleanSubdominio}.com`;
        const adminUser = usuarios.find(u => u.negocio_id === editingNegocioId && u.rol === 'admin');
        if (adminUser) {
          mockDb.updateUsuario(adminUser.id, {
            nombre: editAdminNombre.trim(),
            email: generatedEmail,
            password: editAdminPassword.trim()
          });
        } else {
          mockDb.addUsuario({
            negocio_id: editingNegocioId,
            nombre: editAdminNombre.trim() || 'Administrador',
            email: generatedEmail,
            password: editAdminPassword.trim() || 'admin123',
            rol: 'admin'
          });
        }

        setSuccessMsg(`¡Cliente SaaS "${editNegocioNombre}" y su administrador actualizados con éxito!`);
        setEditingNegocioId(null);
        loadData();
        window.dispatchEvent(new Event('sedeChanged'));
      } else {
        setErrorMsg('No se pudo actualizar el cliente.');
      }
    } catch (err) {
      setErrorMsg('Error al editar cliente.');
    }
  };

  const handleConfirmResetNegocio = () => {
    if (!negocioToReset) return;
    if (negocioResetConfirmText !== 'RESETEAR') {
      setErrorMsg('Debes escribir RESETEAR para confirmar.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = mockDb.clearNegocioData(negocioToReset.id);
      if (res) {
        setSuccessMsg(`¡Historial y datos transaccionales del cliente "${negocioToReset.nombre}" eliminados con éxito! El negocio y su usuario administrador siguen activos.`);
        
        // Registrar acción en bitácora de auditoría
        const activeUser = userName || 'Super Admin';
        mockDb.registrarAuditLog(
          'global-system',
          activeUser,
          'LIMPIEZA_CLIENTE',
          `Limpieza de todos los datos transaccionales de "${negocioToReset.nombre}" para entrega/reutilización.`
        );

        loadData();
        window.dispatchEvent(new Event('sedeChanged'));
      } else {
        setErrorMsg('No se pudo limpiar la información del cliente.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al limpiar los datos.');
    } finally {
      setShowResetNegocioModal(false);
      setNegocioToReset(null);
      setNegocioResetConfirmText('');
      setEditingNegocioId(null);
    }
  };

  // ==============================================================
  // ACCIÓN: CAMBIAR LA CONTRASEÑA DEL ADMINISTRADOR DE SEDE (POS)
  // Guarda el nuevo valor en localStorage para que el Login lo lea de inmediato.
  // ==============================================================
  const handleChangeAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!updateAdminPassword.trim()) {
      setErrorMsg('La contraseña no puede estar vacía.');
      return;
    }
    // Guarda la contraseña de forma dinámica en localStorage
    localStorage.setItem('alico_admin_password', updateAdminPassword.trim());
    setSuccessMsg('Contraseña del Administrador de Sede por defecto actualizada con éxito.');
    setUpdateAdminPassword('');
  };

  // ==============================================================
  // ACCIÓN: CAMBIAR LA CONTRASEÑA DEL PROPIETARIO (SUPER ADMINISTRADOR)
  // Guarda el nuevo valor en localStorage para restringir el acceso a esta consola.
  // ==============================================================
  const handleChangeSuperPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!newSuperPassword.trim()) {
      setErrorMsg('La contraseña no puede estar vacía.');
      return;
    }
    // Guarda la clave en el almacenamiento del cliente
    localStorage.setItem('alico_super_password', newSuperPassword.trim());
    setSuccessMsg('Contraseña del Super Administrador actualizada con éxito.');
    setNewSuperPassword('');
  };



  // 3. INYECTOR SIMULADO DE VENTAS PARA AUDITORÍA
  const handleInjectMockVentas = () => {
    if (sedes.length === 0) return;
    setErrorMsg('');
    setSuccessMsg('');

    const randomSede = sedes[Math.floor(Math.random() * sedes.length)];
    const montosSimulados = [45000, 89000, 120000, 35000, 240000];
    const monto = montosSimulados[Math.floor(Math.random() * montosSimulados.length)];
    const cajeros = ['Cajero Automático', 'Diana Barra', 'Juan Sede Centro'];
    const cajero = cajeros[Math.floor(Math.random() * cajeros.length)];
    const metodos = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const;
    const metodo = metodos[Math.floor(Math.random() * metodos.length)];

    mockDb.registrarVenta({
      sede_id: randomSede.id,
      cliente_nombre: 'Cliente Simulación',
      total: monto,
      metodo_pago: metodo,
      atendido_por: cajero,
      es_directa: false, // Evitar descontar stock real para la simulación
      items: [
        { producto_id: 'p-sim', nombre: 'Pack Licores Importados (Simulación)', cantidad: 1, precio_unitario: monto }
      ]
    });

    setSuccessMsg(`¡Inyectada Venta simulada de $${monto.toLocaleString('es-CO')} en "${randomSede.nombre}"!`);
    loadData();

    // Disparar sincronización
    window.dispatchEvent(new Event('sedeChanged'));
  };

  // ==============================================================
  // ACCIÓN: EXPORTAR REPORTE GENERAL A EXCEL (.xls con Estilo Premium)
  // Unifica las tablas de Inventario y Ventas en un solo libro
  // ==============================================================
  const handleExportGeneralExcel = async () => {
    try {
      setSuccessMsg('Consultando base de datos en tiempo real desde Supabase...');

      let data = getMockData();

      // Si estamos conectados a Supabase en Producción Cloud, consultar datos reales frescos directamente
      if (!isMockMode && supabase) {
        try {
          const [sedesRes, productosRes, ventasRes] = await Promise.all([
            supabase.from('sedes').select('*'),
            supabase.from('productos').select('*'),
            supabase.from('ventas').select('*')
          ]);

          if (!sedesRes.error && !productosRes.error && !ventasRes.error) {
            data = {
              ...data,
              sedes: sedesRes.data || [],
              productos: productosRes.data || [],
              ventas: ventasRes.data || []
            };
          }
        } catch (e) {
          console.error('Error al consultar datos en vivo para Excel:', e);
        }
      }

      const listProductos = data.productos;
      const listVentas = data.ventas;

      let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
    
    /* Encabezados y títulos */
    .title-row { font-size: 16px; font-weight: bold; color: #1e293b; padding: 10px 0; }
    .meta-row { font-size: 10px; color: #64748b; padding-bottom: 15px; }
    
    /* Tabla Inventario (Cian) */
    th.inv-header { background-color: #06b6d4; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 11px; }
    td.inv-cell { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 11px; color: #334155; }
    
    /* Tabla Ventas (Dorado) */
    th.vta-header { background-color: #f59e0b; color: #000000; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 11px; }
    td.vta-cell { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 11px; color: #334155; }
    
    /* Estados y vacíos */
    .empty-row { font-size: 11px; color: #64748b; font-style: italic; text-align: center; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <!-- TABLA 1: INVENTARIO DE BODEGA -->
  <table>
    <tr>
      <td colspan="8" class="title-row" style="border: none;">REPORTE GENERAL DE INVENTARIO - NEXUS BODEGA</td>
    </tr>
    <tr>
      <td colspan="8" class="meta-row" style="border: none;">Generado el: ${new Date().toLocaleString('es-CO')} | Canal: Auditoría SaaS</td>
    </tr>
    <tr style="height: 25px;">
      <th class="inv-header">Código Barras</th>
      <th class="inv-header">Categoría</th>
      <th class="inv-header">Nombre Licor / Bebida</th>
      <th class="inv-header">Costo Compra</th>
      <th class="inv-header">Precio Venta Público</th>
      <th class="inv-header">Existencia Actual</th>
      <th class="inv-header">Existencia Mínima</th>
      <th class="inv-header">Sede</th>
    </tr>`;

      if (listProductos.length === 0) {
        html += `
    <tr>
      <td colspan="8" class="empty-row">No hay licores en el catálogo de inventario actualmente registrado.</td>
    </tr>`;
      } else {
        listProductos.forEach(p => {
          const sede = data.sedes.find(s => s.id === p.sede_id)?.nombre || p.sede_id;
          html += `
    <tr>
      <td class="inv-cell" style="font-family: monospace;">${p.codigo_barras}</td>
      <td class="inv-cell">${p.categoria}</td>
      <td class="inv-cell" style="font-weight: bold;">${p.nombre}</td>
      <td class="inv-cell">$${p.precio_compra.toLocaleString('es-CO')}</td>
      <td class="inv-cell" style="color: #d97706; font-weight: bold;">$${p.precio_venta.toLocaleString('es-CO')}</td>
      <td class="inv-cell" style="font-weight: bold; ${p.stock_actual <= p.stock_minimo ? 'color: #dc2626;' : 'color: #16a34a;'}">${p.stock_actual} U.</td>
      <td class="inv-cell">${p.stock_minimo} U.</td>
      <td class="inv-cell">${sede}</td>
    </tr>`;
        });
      }

      html += `
  </table>

  <!-- ESPACIADOR -->
  <table>
    <tr><td colspan="8" style="height: 20px; border: none;">&nbsp;</td></tr>
  </table>

  <!-- TABLA 2: HISTORIAL DE VENTAS CONSOLIDADAS -->
  <table>
    <tr>
      <td colspan="7" class="title-row" style="border: none;">REPORTE CONSOLIDADO DE VENTAS - NEXUS SAAS</td>
    </tr>
    <tr>
      <td colspan="7" class="meta-row" style="border: none;">Generado el: ${new Date().toLocaleString('es-CO')} | Canal: Producción SaaS Cloud</td>
    </tr>
    <tr style="height: 25px;">
      <th class="vta-header">ID Venta</th>
      <th class="vta-header">Sede</th>
      <th class="vta-header">Cliente</th>
      <th class="vta-header">Total Recaudado</th>
      <th class="vta-header">Método Pago</th>
      <th class="vta-header">Cajero / Mesero</th>
      <th class="vta-header">Fecha y Hora</th>
    </tr>`;

      if (listVentas.length === 0) {
        html += `
    <tr>
      <td colspan="7" class="empty-row">No se registran ventas facturadas en el sistema actualmente.</td>
    </tr>`;
      } else {
        listVentas.forEach(v => {
          const sede = data.sedes.find(s => s.id === v.sede_id)?.nombre || v.sede_id;
          const fecha = new Date(v.fecha_hora).toLocaleString('es-CO');
          html += `
    <tr>
      <td class="vta-cell">${v.id}</td>
      <td class="vta-cell">${sede}</td>
      <td class="vta-cell">${v.cliente_nombre}</td>
      <td class="vta-cell" style="font-weight: bold; color: #16a34a;">$${v.total.toLocaleString('es-CO')}</td>
      <td class="vta-cell">${v.metodo_pago}</td>
      <td class="vta-cell">${v.atendido_por}</td>
      <td class="vta-cell">${fecha}</td>
    </tr>`;
        });
      }

      html += `
  </table>
</body>
</html>`;

      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `NEXUS_Reporte_General_Excel_${new Date().toISOString().slice(0, 10)}.xls`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccessMsg('¡Reporte General unificado de Inventario y Ventas descargado con éxito!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Error al exportar el reporte general unificado.');
    }
  };

  // Totales consolidados de todas las sedes (excluyendo anuladas)
  const totalRecaudadoConsolidado = ventas.filter(v => v.estado !== 'ANULADA').reduce((s, v) => s + v.total, 0);
  const totalProductosConsolidado = productos.length;

  return (
    <div className="min-h-screen bg-[#020205] text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Panel */}
        <header className="glass-panel border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500/20 via-amber-500/40 to-transparent"></div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black tracking-widest bg-amber-500 text-black px-2.5 py-0.5 rounded-lg uppercase">
                Owner Console
              </span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                Consola SaaS de Clientes
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1.5 font-sans">
              NEXUS SAAS • Super Administrador
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Bienvenido creador: <span className="text-amber-500 font-semibold">{userName}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleInjectMockVentas}
              className="px-4 h-9 bg-zinc-950/80 border border-white/10 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-amber-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7C4.647 9.547 4.6 10.768 4.6 12c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.092-1.209.138-2.43.138-3.662z" />
              </svg>
              Simular Venta Rápida
            </button>
            <button
              onClick={handleExportGeneralExcel}
              className="px-4 h-9 bg-[#f59e0b] hover:bg-[#d97706] text-black text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer animate-fade-in"
              title="Descargar reporte general unificado (Inventario y Ventas) en Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Descargar Reporte General Excel
            </button>
            <button
              onClick={handleLogout}
              className="px-4 h-9 bg-red-950/20 border border-red-500/25 text-red-400 hover:bg-red-950/40 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
            >
              Cerrar Consola
            </button>
          </div>
        </header>

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold animate-fade-in">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold animate-fade-in">
            {errorMsg}
          </div>
        )}

        {/* KPIs Consolidados Globales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Clientes SaaS (Negocios)</p>
            <p className="text-2xl font-black text-white mt-2">{negocios.length} Inquilinos</p>
            <span className="text-[9px] text-zinc-400 block mt-2">Empresas / Bares independientes</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Recaudo Global Consolidado</p>
            <p className="text-2xl font-black text-emerald-400 mt-2">${totalRecaudadoConsolidado.toLocaleString('es-CO')}</p>
            <span className="text-[9px] text-emerald-500 block mt-2">Suma de ventas de todas las sedes</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Sucursales (Sedes) Totales</p>
            <p className="text-2xl font-black text-amber-500 mt-2">{sedes.length} Sucursales</p>
            <span className="text-[9px] text-zinc-400 block mt-2">Puntos de venta físicos del ecosistema</span>
          </div>
        </div>

        {/* Formularios y Listado de Sedes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Lado Izquierdo (2 spans): Clientes SaaS e Historial Consolidadas */}
          <div className="lg:col-span-2 space-y-6">

            {/* Listado de Clientes SaaS */}
            <div className="glass-card rounded-2xl p-5 border border-white/5">
              <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-4">
                Clientes SaaS (Establecimientos / Cuentas)
              </h3>

              <div className="space-y-3">
                {negocios.map((n) => {
                  const sedesNegocio = sedes.filter(s => s.negocio_id === n.id);
                  const sedeIds = sedesNegocio.map(s => s.id);
                  const ventasNegocio = ventas.filter(v => {
                    return v.estado !== 'ANULADA' && (v.sede_id === n.id || sedeIds.includes(v.sede_id));
                  });
                  const totalNegocio = ventasNegocio.reduce((sum, v) => sum + v.total, 0);
                  const adminUser = usuarios.find(u => u.negocio_id === n.id);

                  return (
                    <div key={n.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center">
                          <h4 className="text-xs font-bold text-white">{n.nombre}</h4>
                          {n.estado_suscripcion === 'SUSPENDIDO' ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7.5px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 ml-2">SUSPENDIDO</span>
                          ) : n.estado_suscripcion === 'DEMO' ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7.5px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2">DEMO</span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7.5px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-2">ACTIVO</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1.5 text-[9px] text-zinc-500">
                          {n.rut && <p className="font-bold">RUT: <span className="text-zinc-400 font-medium">{n.rut}</span></p>}
                          {n.direccion && <p className="font-bold">Dir: <span className="text-zinc-400 font-medium">{n.direccion}</span></p>}
                          {adminUser && <p className="font-bold">Admin: <span className="text-amber-500 font-medium">{adminUser.nombre} ({adminUser.email})</span></p>}
                          <p className="font-bold">Plan SaaS: <span className="text-zinc-300 font-semibold">{n.plan_activo || 'Básico'}</span> | Vence: <span className="text-zinc-300 font-semibold">{n.fecha_vencimiento || 'Sin límite'}</span></p>
                          <p className="font-bold">Sucursales: <span className="text-zinc-400 font-medium">{sedesNegocio.length} activas</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-xs font-black text-emerald-400">
                            ${totalNegocio.toLocaleString('es-CO')}
                          </p>
                          <p className="text-[9px] text-zinc-500 mt-0.5 font-semibold">
                            {ventasNegocio.length} ventas
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenEditNegocio(n)}
                          className="h-8 py-1.5 px-3 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300 text-[10px] font-bold rounded-lg transition-all"
                        >
                          Editar Cliente
                        </button>
                        <button
                          onClick={() => {
                            setNegocioToDelete(n);
                            setNegocioDeleteConfirmText('');
                            setShowDeleteNegocioModal(true);
                          }}
                          className="h-8 w-8 flex items-center justify-center bg-red-950/20 hover:bg-red-900/30 border border-red-500/15 text-red-400 hover:text-red-300 rounded-lg transition-all cursor-pointer"
                          title="Eliminar Cliente SaaS"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            const defaultSede = sedesNegocio.length > 0 ? sedesNegocio[0].id : 'sede-norte';
                            localStorage.setItem('alico_active_sede', defaultSede);
                            
                            const mockAdminSession = {
                              id: adminUser?.id || 'usr-admin',
                              email: adminUser?.email || `admin@${n.subdominio || 'nexus'}.com`,
                              role: 'admin',
                              nombre: adminUser?.nombre || 'Administrador',
                              negocio_id: n.id,
                              timestamp: Date.now()
                            };
                            localStorage.setItem('alico_session', JSON.stringify(mockAdminSession));
                            router.push('/dashboard');
                            window.dispatchEvent(new Event('sedeChanged'));
                          }}
                          className="h-8 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black rounded-lg transition-all"
                        >
                          Entrar POS
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historial Consolidado de Ventas Globales */}
            <div className="glass-card rounded-2xl p-5 border border-white/5">
              <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-4">
                Historial de Transacciones Globales
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-black/20">
                      <th className="py-2.5 px-2">Sede</th>
                      <th className="py-2.5 px-2">Fecha & Hora</th>
                      <th className="py-2.5 px-2">Atendido Por</th>
                      <th className="py-2.5 px-2 text-center">Método</th>
                      <th className="py-2.5 px-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ventas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-zinc-600 font-semibold">
                          Ninguna venta facturada en el sistema.
                        </td>
                      </tr>
                    ) : (
                      ventas.slice(0, 10).map((v) => {
                        const sede = sedes.find(s => s.id === v.sede_id);
                        const fecha = new Date(v.fecha_hora);
                        const fechaStr = fecha.toLocaleDateString('es-CO') + ' ' + fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={v.id} className="text-[11px] text-zinc-300">
                            <td className="py-2.5 px-2 font-bold text-white max-w-[120px] truncate">{sede?.nombre || 'Sede Eliminada'}</td>
                            <td className="py-2.5 px-2 font-mono text-[10px] text-zinc-500">{fechaStr}</td>
                            <td className="py-2.5 px-2 text-zinc-400 font-medium">{v.atendido_por}</td>
                            <td className="py-2.5 px-2 text-center text-[10px]">
                              <span className="bg-zinc-900 border border-white/5 px-1.5 py-0.5 rounded text-zinc-400">
                                {v.metodo_pago}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-black text-emerald-400">${v.total.toLocaleString('es-CO')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Lado Derecho (1 span): Formulario de Registro SaaS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500/20 via-amber-500/40 to-transparent"></div>
              
              <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-4">
                Registrar Cliente SaaS
              </h3>

              <form onSubmit={handleCreateClienteSaaS} className="space-y-4">
                {/* Datos del Negocio */}
                <div className="border-b border-white/5 pb-3">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3">1. Datos de la Empresa</p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                        Nombre del Negocio *
                      </label>
                      <input
                        type="text"
                        required
                        value={newNegocioNombre}
                        onChange={(e) => {
                          setNewNegocioNombre(e.target.value);
                          // Sugerir subdominio automáticamente al escribir
                          if (!newNegocioSubdominio) {
                            setNewNegocioSubdominio(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                          }
                        }}
                        placeholder="Ej. Nexus Gastrobar Sur"
                        className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                        Subdominio del Bar * (Solo letras y números)
                      </label>
                      <input
                        type="text"
                        required
                        value={newNegocioSubdominio}
                        onChange={(e) => {
                          const clean = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                          setNewNegocioSubdominio(clean);
                        }}
                        placeholder="Ej. nexus"
                        className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                        RUT / NIT (Opcional)
                      </label>
                      <input
                        type="text"
                        value={newNegocioRut}
                        onChange={(e) => setNewNegocioRut(e.target.value)}
                        placeholder="Ej. 901.444.555-9"
                        className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                        Dirección (Opcional)
                      </label>
                      <input
                        type="text"
                        value={newNegocioDireccion}
                        onChange={(e) => setNewNegocioDireccion(e.target.value)}
                        placeholder="Ej. Carrera 45 #80-12"
                        className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Datos del Administrador */}
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">2. Credenciales Administrador</p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                        Nombre del Administrador *
                      </label>
                      <input
                        type="text"
                        required
                        value={newAdminNombre}
                        onChange={(e) => setNewAdminNombre(e.target.value)}
                        placeholder="Ej. Carlos Pérez"
                        className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                        Email de Ingreso (Autogenerado)
                      </label>
                      <div className="w-full h-9 px-3 rounded-lg glass-input text-xs text-zinc-400 font-mono flex items-center bg-black/40 border border-white/5 select-all">
                        {newNegocioSubdominio ? `admin@${newNegocioSubdominio.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : 'admin@<subdominio>.com'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                        Contraseña *
                      </label>
                      <input
                        type="password"
                        required
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-black shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Registrar Cliente SaaS
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE DEPURACIÓN Y LIMPIEZA SELECTIVA */}
        <section className="glass-panel border border-white/5 rounded-2xl p-6 relative overflow-hidden space-y-6">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500/20 via-yellow-500/40 to-transparent"></div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-[10px] font-black tracking-widest bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-lg uppercase border border-amber-500/20">
                Herramientas de Depuración
              </span>
              <h2 className="text-lg font-black text-white mt-2 font-sans flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-amber-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                </svg>
                Depuración y Limpieza Selectiva (Registros de Prueba)
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Elimina selectivamente transacciones simuladas o de ensayo para no descuadrar tus reportes reales de ventas.
              </p>
            </div>
          </div>

          {/* Filtros de Búsqueda y Sede */}
          <div className="flex flex-col sm:flex-row gap-3 bg-black/30 p-3.5 rounded-2xl border border-white/5">
            <div className="flex-1">
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 pl-1">Buscar por cliente o detalle</label>
              <div className="relative">
                <input
                  type="text"
                  value={debugSearchTerm}
                  onChange={(e) => setDebugSearchTerm(e.target.value)}
                  placeholder="Escribe cliente o descripción..."
                  className="w-full h-9 pl-8 pr-3 rounded-xl glass-input text-xs text-white"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-zinc-500 absolute left-2.5 top-2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
                </svg>
              </div>
            </div>

            <div className="sm:w-64">
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 pl-1">Filtrar Sede</label>
              <select
                value={selectedSedeFilter}
                onChange={(e) => setSelectedSedeFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-xl glass-input text-xs text-white cursor-pointer"
              >
                <option value="TODAS">Ver Todas las Sedes</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pestañas de Navegación del Panel */}
          <div className="flex border-b border-white/5 gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveDebugTab('ventas')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeDebugTab === 'ventas'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              Historial de Ventas ({ventas.length})
            </button>
            <button
              onClick={() => setActiveDebugTab('creditos')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeDebugTab === 'creditos'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              Cartera de Créditos ({creditos.length})
            </button>
            <button
              onClick={() => setActiveDebugTab('cierres')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeDebugTab === 'cierres'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              Arqueos / Cierres ({cierres.length})
            </button>
            <button
              onClick={() => setActiveDebugTab('prestamos')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeDebugTab === 'prestamos'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              Préstamos de Envases ({prestamos.length})
            </button>
          </div>

          {/* Tablas de Contenido */}
          <div className="overflow-x-auto">
            {activeDebugTab === 'ventas' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-black/20">
                    <th className="py-2.5 px-2">Sede</th>
                    <th className="py-2.5 px-2">Fecha y Hora</th>
                    <th className="py-2.5 px-2">Cliente</th>
                    <th className="py-2.5 px-2">Método</th>
                    <th className="py-2.5 px-2 text-right">Total</th>
                    <th className="py-2.5 px-2">Atendido Por</th>
                    <th className="py-2.5 px-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ventas
                    .filter(v => selectedSedeFilter === 'TODAS' || v.sede_id === selectedSedeFilter)
                    .filter(v => v.cliente_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()) || v.id.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                    .length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-zinc-600 font-semibold">
                          No se encontraron ventas para los criterios de filtro activos.
                        </td>
                      </tr>
                    ) : (
                      ventas
                        .filter(v => selectedSedeFilter === 'TODAS' || v.sede_id === selectedSedeFilter)
                        .filter(v => v.cliente_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()) || v.id.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                        .map((v) => {
                          const sede = sedes.find(s => s.id === v.sede_id);
                          const fecha = new Date(v.fecha_hora);
                          const fechaStr = fecha.toLocaleDateString('es-CO') + ' ' + fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <tr key={v.id} className="text-[11px] text-zinc-300 hover:bg-white/[0.02] transition-colors">
                              <td className="py-2 px-2 font-bold text-white max-w-[120px] truncate">{sede?.nombre || 'Sede Eliminada'}</td>
                              <td className="py-2 px-2 font-mono text-[10px] text-zinc-500">{fechaStr}</td>
                              <td className="py-2 px-2 text-zinc-400 font-medium">{v.cliente_nombre}</td>
                              <td className="py-2 px-2 text-center text-[10px]">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  v.metodo_pago === 'CREDITO' ? 'bg-red-500/10 text-red-400 border border-red-500/15' : 'bg-zinc-900 border border-white/5 text-zinc-400'
                                }`}>
                                  {v.metodo_pago}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-black text-emerald-400">${v.total.toLocaleString('es-CO')}</td>
                              <td className="py-2 px-2 text-zinc-400">{v.atendido_por}</td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => handleOpenDeleteModal(v, 'venta')}
                                  className="p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar venta de forma definitiva"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                </tbody>
              </table>
            )}

            {activeDebugTab === 'creditos' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-black/20">
                    <th className="py-2.5 px-2">Sede</th>
                    <th className="py-2.5 px-2">Fecha Registro</th>
                    <th className="py-2.5 px-2">Cliente</th>
                    <th className="py-2.5 px-2 text-right">Deuda Inicial</th>
                    <th className="py-2.5 px-2 text-right">Monto Pagado</th>
                    <th className="py-2.5 px-2 text-right">Saldo Restante</th>
                    <th className="py-2.5 px-2 text-center">Estado</th>
                    <th className="py-2.5 px-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {creditos
                    .filter(c => selectedSedeFilter === 'TODAS' || c.sede_id === selectedSedeFilter)
                    .filter(c => c.cliente_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                    .length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-zinc-600 font-semibold">
                          No se encontraron créditos de cartera para los criterios de filtro activos.
                        </td>
                      </tr>
                    ) : (
                      creditos
                        .filter(c => selectedSedeFilter === 'TODAS' || c.sede_id === selectedSedeFilter)
                        .filter(c => c.cliente_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                        .map((c) => {
                          const sede = sedes.find(s => s.id === c.sede_id);
                          const fecha = new Date(c.fecha_registro);
                          const fechaStr = fecha.toLocaleDateString('es-CO') + ' ' + fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                          const restante = c.total_deuda - c.total_pagado;
                          return (
                            <tr key={c.id} className="text-[11px] text-zinc-300 hover:bg-white/[0.02] transition-colors">
                              <td className="py-2 px-2 font-bold text-white max-w-[120px] truncate">{sede?.nombre || 'Sede Eliminada'}</td>
                              <td className="py-2 px-2 font-mono text-[10px] text-zinc-500">{fechaStr}</td>
                              <td className="py-2 px-2 text-zinc-400 font-medium">{c.cliente_nombre}</td>
                              <td className="py-2 px-2 text-right font-semibold text-zinc-300">${c.total_deuda.toLocaleString('es-CO')}</td>
                              <td className="py-2 px-2 text-right text-emerald-400 font-semibold">${c.total_pagado.toLocaleString('es-CO')}</td>
                              <td className="py-2 px-2 text-right font-black text-amber-500">${restante.toLocaleString('es-CO')}</td>
                              <td className="py-2 px-2 text-center text-[10px]">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  c.estado === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-red-500/10 text-red-400 border border-red-500/15'
                                }`}>
                                  {c.estado}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => handleOpenDeleteModal(c, 'credito')}
                                  className="p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar crédito de forma definitiva"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                </tbody>
              </table>
            )}

            {activeDebugTab === 'cierres' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-black/20">
                    <th className="py-2.5 px-2">Sede</th>
                    <th className="py-2.5 px-2">Fecha y Hora</th>
                    <th className="py-2.5 px-2">Registrado Por</th>
                    <th className="py-2.5 px-2 text-right">Ventas Totales</th>
                    <th className="py-2.5 px-2 text-right">Monto Real</th>
                    <th className="py-2.5 px-2 text-right">Descuadre</th>
                    <th className="py-2.5 px-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cierres
                    .filter(c => selectedSedeFilter === 'TODAS' || c.sede_id === selectedSedeFilter)
                    .filter(c => c.registrado_por.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                    .length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-zinc-600 font-semibold">
                          No se encontraron arqueos/cierres de caja para los criterios de filtro activos.
                        </td>
                      </tr>
                    ) : (
                      cierres
                        .filter(c => selectedSedeFilter === 'TODAS' || c.sede_id === selectedSedeFilter)
                        .filter(c => c.registrado_por.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                        .map((c) => {
                          const sede = sedes.find(s => s.id === c.sede_id);
                          const fecha = new Date(c.fecha_hora);
                          const fechaStr = fecha.toLocaleDateString('es-CO') + ' ' + fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <tr key={c.id} className="text-[11px] text-zinc-300 hover:bg-white/[0.02] transition-colors">
                              <td className="py-2 px-2 font-bold text-white max-w-[120px] truncate">{sede?.nombre || 'Sede Eliminada'}</td>
                              <td className="py-2 px-2 font-mono text-[10px] text-zinc-500">{fechaStr}</td>
                              <td className="py-2 px-2 text-zinc-400 font-medium">{c.registrado_por}</td>
                              <td className="py-2 px-2 text-right font-semibold text-zinc-300">${c.ventas_total.toLocaleString('es-CO')}</td>
                              <td className="py-2 px-2 text-right font-semibold text-emerald-400">${c.monto_real.toLocaleString('es-CO')}</td>
                              <td className={`py-2 px-2 text-right font-black ${
                                c.descuadre !== 0 ? 'text-red-400' : 'text-zinc-500'
                              }`}>
                                {c.descuadre > 0 ? '+' : ''}${c.descuadre.toLocaleString('es-CO')}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => handleOpenDeleteModal(c, 'cierre')}
                                  className="p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar cierre de caja de forma definitiva"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                </tbody>
              </table>
            )}

            {activeDebugTab === 'prestamos' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-black/20">
                    <th className="py-2.5 px-2">Sede</th>
                    <th className="py-2.5 px-2">Fecha Préstamo</th>
                    <th className="py-2.5 px-2">Cliente</th>
                    <th className="py-2.5 px-2">Nombre Botella</th>
                    <th className="py-2.5 px-2 text-right">Cantidad</th>
                    <th className="py-2.5 px-2 text-center">Estado</th>
                    <th className="py-2.5 px-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {prestamos
                    .filter(p => selectedSedeFilter === 'TODAS' || p.sede_id === selectedSedeFilter)
                    .filter(p => p.cliente_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()) || p.botella_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                    .length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-zinc-600 font-semibold">
                          No se encontraron préstamos de envases para los criterios de filtro activos.
                        </td>
                      </tr>
                    ) : (
                      prestamos
                        .filter(p => selectedSedeFilter === 'TODAS' || p.sede_id === selectedSedeFilter)
                        .filter(p => p.cliente_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()) || p.botella_nombre.toLowerCase().includes(debugSearchTerm.toLowerCase()))
                        .map((p) => {
                          const sede = sedes.find(s => s.id === p.sede_id);
                          const fecha = new Date(p.fecha_prestamo);
                          const fechaStr = fecha.toLocaleDateString('es-CO') + ' ' + fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <tr key={p.id} className="text-[11px] text-zinc-300 hover:bg-white/[0.02] transition-colors">
                              <td className="py-2 px-2 font-bold text-white max-w-[120px] truncate">{sede?.nombre || 'Sede Eliminada'}</td>
                              <td className="py-2 px-2 font-mono text-[10px] text-zinc-500">{fechaStr}</td>
                              <td className="py-2 px-2 text-zinc-400 font-medium">{p.cliente_nombre}</td>
                              <td className="py-2 px-2 text-zinc-400">{p.botella_nombre}</td>
                              <td className="py-2 px-2 text-right font-bold text-zinc-300">{p.cantidad} U.</td>
                              <td className="py-2 px-2 text-center text-[10px]">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  p.estado === 'DEVUELTO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                                }`}>
                                  {p.estado}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => handleOpenDeleteModal(p, 'prestamo')}
                                  className="p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar préstamo de forma definitiva"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                </tbody>
              </table>
            )}
          </div>
        </section>

    {/* Sección: Base de Datos & Seguridad */ }
    < section className = "glass-panel border border-white/5 rounded-2xl p-6 relative overflow-hidden space-y-6" >
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500/20 via-red-500/40 to-transparent"></div>

          <div>
            <span className="text-[10px] font-black tracking-widest bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-lg uppercase border border-red-500/20">
              Seguridad & Mantenimiento
            </span>
            <h2 className="text-lg font-black text-white mt-2 font-sans flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Base de Datos & Control de Accesos
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Administración de contraseñas globales del sistema y purga/restablecimiento de registros.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Cambiar Clave Admin */}
            <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Clave Administrador (POS)</h3>
              </div>
              <form onSubmit={handleChangeAdminPassword} className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    value={updateAdminPassword}
                    onChange={(e) => setUpdateAdminPassword(e.target.value)}
                    placeholder="Ej. admin2026*"
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-black transition-all"
                >
                  Actualizar Clave Admin
                </button>
              </form>
            </div>

            {/* Cambiar Clave Super Admin */}
            <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
              <div className="flex items-center gap-2 text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Clave Propietario (Super Admin)</h3>
              </div>
              <form onSubmit={handleChangeSuperPassword} className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    value={newSuperPassword}
                    onChange={(e) => setNewSuperPassword(e.target.value)}
                    placeholder="Ej. super2026*"
                    className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black transition-all"
                >
                  Actualizar Clave Super
                </button>
              </form>
            </div>

          </div>
        </section >

      </div >

  {/* Modal de Confirmación para Borrado Individual */}
  {showDeleteModal && itemToDelete && typeToDelete && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-card border border-red-500/25 shadow-2xl shadow-red-500/5 rounded-3xl p-6 md:p-8 w-full max-w-sm relative overflow-hidden bg-[#06060c]/95 text-center">
        <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none bg-red-500"></div>

        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center border bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </div>
        </div>

        <h3 className="text-base font-bold text-white mb-2">¿Confirmar eliminación definitiva?</h3>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          {typeToDelete === 'venta' && `Esto eliminará permanentemente la venta de ${itemToDelete.cliente_nombre} por $${itemToDelete.total.toLocaleString('es-CO')}. Si fue una venta a crédito, también se borrará el crédito de cartera.`}
          {typeToDelete === 'credito' && `Esto eliminará permanentemente el crédito de ${itemToDelete.cliente_nombre} por $${itemToDelete.total_deuda.toLocaleString('es-CO')} de la cartera de fiados.`}
          {typeToDelete === 'cierre' && `Esto eliminará permanentemente el arqueo/cierre de caja registrado el ${new Date(itemToDelete.fecha_hora).toLocaleDateString('es-CO')} por un total de $${itemToDelete.ventas_total.toLocaleString('es-CO')}.`}
          {typeToDelete === 'prestamo' && `Esto eliminará permanentemente el préstamo de ${itemToDelete.cantidad} botellas de ${itemToDelete.botella_nombre} a ${itemToDelete.cliente_nombre}.`}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirmDelete}
            className="w-full h-10 rounded-xl bg-red-500 hover:bg-red-600 text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/10 cursor-pointer"
          >
            Confirmar y Borrar
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(false);
              setItemToDelete(null);
              setTypeToDelete(null);
            }}
            className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 hover:text-white text-xs font-bold transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Modal de Confirmación para Borrado de Negocio (Cliente SaaS) al estilo GitHub */}
  {showDeleteNegocioModal && negocioToDelete && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-card border border-red-500/20 shadow-2xl shadow-red-500/5 rounded-3xl p-6 md:p-8 w-full max-w-md relative overflow-hidden bg-[#06060c]/95">
        <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none bg-red-500"></div>

        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center border bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="text-base font-bold text-white mb-2">¿Eliminar Cliente SaaS definitivamente?</h3>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Esta acción es irreversible y eliminará el negocio <strong>{negocioToDelete.nombre}</strong> junto con todas sus sucursales, usuarios administradores, productos, consumos, mesas y reportes financieros asociados.
          </p>
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 text-left mb-5">
            <p className="text-[10px] text-zinc-400 leading-normal">
              Para confirmar la eliminación, escribe exactamente el nombre de la empresa:
            </p>
            <p className="text-xs font-bold text-white select-all mt-1 font-mono">{negocioToDelete.nombre}</p>
          </div>
          
          <input
            type="text"
            required
            value={negocioDeleteConfirmText}
            onChange={(e) => setNegocioDeleteConfirmText(e.target.value)}
            placeholder="Escribe el nombre de la empresa aquí"
            className="w-full h-10 px-3 rounded-lg glass-input text-xs text-white text-center font-bold focus:ring-red-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirmDeleteNegocio}
            disabled={negocioDeleteConfirmText !== negocioToDelete.nombre}
            className="w-full h-10 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:hover:bg-red-500 text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/10 cursor-pointer"
          >
            Confirmar y Eliminar Cuenta SaaS
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDeleteNegocioModal(false);
              setNegocioToDelete(null);
              setNegocioDeleteConfirmText('');
            }}
            className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 hover:text-white text-xs font-bold transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Modal de Edición de Negocio (Cliente SaaS) */}
  {editingNegocioId && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-card border border-white/10 shadow-2xl rounded-3xl p-6 md:p-8 w-full max-w-sm relative overflow-y-auto max-h-[90vh] bg-[#06060c]/95 scrollbar-thin">
        <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none bg-amber-500"></div>

        <div className="text-center mb-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Editar Cliente SaaS</h3>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono">ID: {editingNegocioId}</p>
        </div>

        <form onSubmit={handleSaveNegocioEdit} className="space-y-4 text-left">
          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              Nombre de la Empresa / Bar
            </label>
            <input
              type="text"
              required
              value={editNegocioNombre}
              onChange={(e) => setEditNegocioNombre(e.target.value)}
              placeholder="Ej. Sede Norte"
              className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              Subdominio / Identificador Único * (Solo letras y números)
            </label>
            <input
              type="text"
              required
              value={editNegocioSubdominio}
              onChange={(e) => setEditNegocioSubdominio(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              placeholder="Ej. nexus"
              className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              RUT / NIT
            </label>
            <input
              type="text"
              value={editNegocioRut}
              onChange={(e) => setEditNegocioRut(e.target.value)}
              placeholder="Ej. 901.234.567-1"
              className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              Dirección
            </label>
            <input
              type="text"
              value={editNegocioDireccion}
              onChange={(e) => setEditNegocioDireccion(e.target.value)}
              placeholder="Ej. Calle 123"
              className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                Plan Activo
              </label>
              <input
                type="text"
                required
                value={editNegocioPlanActivo}
                onChange={(e) => setEditNegocioPlanActivo(e.target.value)}
                placeholder="Ej. Premium"
                className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                Estado Suscripción
              </label>
              <select
                value={editNegocioEstadoSuscripcion}
                onChange={(e) => setEditNegocioEstadoSuscripcion(e.target.value as any)}
                className="w-full h-9 px-2 rounded-lg glass-input text-xs text-white bg-zinc-950 border border-white/10"
              >
                <option value="ACTIVO" className="bg-zinc-950 text-white">ACTIVO</option>
                <option value="SUSPENDIDO" className="bg-zinc-950 text-white">SUSPENDIDO</option>
                <option value="DEMO" className="bg-zinc-950 text-white">DEMO</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              Fecha Vencimiento Plan
            </label>
            <input
              type="date"
              required
              value={editNegocioFechaVencimiento}
              onChange={(e) => setEditNegocioFechaVencimiento(e.target.value)}
              className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white bg-zinc-950"
            />
          </div>

          <div className="border-t border-white/5 pt-3 mt-3">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">Administrador de la Cuenta</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editAdminNombre}
                  onChange={(e) => setEditAdminNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                  Email de Ingreso (Autogenerado)
                </label>
                <div className="w-full h-9 px-3 rounded-lg glass-input text-xs text-zinc-400 font-mono flex items-center bg-black/40 border border-white/5 select-all">
                  {editNegocioSubdominio ? `admin@${editNegocioSubdominio.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : 'admin@<subdominio>.com'}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                  placeholder="Contraseña del Administrador"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-red-500/10 pt-3 mt-3 space-y-3">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest pl-1">Zona de Control y Limpieza</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const currentNeg = negocios.find(n => n.id === editingNegocioId);
                  if (currentNeg) {
                    setNegocioToReset(currentNeg);
                    setNegocioResetConfirmText('');
                    setShowResetNegocioModal(true);
                  }
                }}
                className="h-9 px-2 bg-yellow-950/20 hover:bg-yellow-900/30 border border-yellow-500/15 text-yellow-400 hover:text-yellow-300 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center text-center"
              >
                Limpiar Historial
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentNeg = negocios.find(n => n.id === editingNegocioId);
                  if (currentNeg) {
                    setNegocioToDelete(currentNeg);
                    setNegocioDeleteConfirmText('');
                    setShowDeleteNegocioModal(true);
                    setEditingNegocioId(null);
                  }
                }}
                className="h-9 px-2 bg-red-950/20 hover:bg-red-900/30 border border-red-500/15 text-red-400 hover:text-red-300 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center text-center"
              >
                Eliminar Cliente
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              Guardar Cambios
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingNegocioId(null);
                setEditNegocioNombre('');
                setEditNegocioRut('');
                setEditNegocioDireccion('');
                setEditNegocioPlanActivo('Básico');
                setEditNegocioEstadoSuscripcion('ACTIVO');
                setEditNegocioFechaVencimiento('');
                setEditAdminNombre('');
                setEditAdminEmail('');
                setEditAdminPassword('');
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

  {/* Modal de Confirmación para Reseteo/Limpieza de Negocio */}
  {showResetNegocioModal && negocioToReset && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-card border border-yellow-500/20 shadow-2xl shadow-yellow-500/5 rounded-3xl p-6 md:p-8 w-full max-w-md relative overflow-hidden bg-[#06060c]/95">
        <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none bg-yellow-500"></div>

        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-yellow-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="text-base font-bold text-white mb-2">¿Limpiar historial de este establecimiento?</h3>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Esto eliminará de forma permanente todas las ventas, deudas de cartera, cierres de caja, préstamos de envases, movimientos de inventario y logs de auditoría de <strong>{negocioToReset.nombre}</strong>.
            <br />
            <span className="text-yellow-400 font-bold block mt-2">El negocio y su usuario administrador de acceso NO se borrarán.</span>
          </p>
          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3.5 text-left mb-5">
            <p className="text-[10px] text-zinc-400 leading-normal">
              Para confirmar la limpieza, escribe exactamente la palabra de control en mayúsculas:
            </p>
            <p className="text-xs font-bold text-white select-all mt-1 font-mono">RESETEAR</p>
          </div>
          
          <input
            type="text"
            required
            value={negocioResetConfirmText}
            onChange={(e) => setNegocioResetConfirmText(e.target.value)}
            placeholder="Escribe RESETEAR aquí"
            className="w-full h-10 px-3 rounded-lg glass-input text-xs text-white text-center font-bold focus:ring-yellow-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirmResetNegocio}
            disabled={negocioResetConfirmText !== 'RESETEAR'}
            className="w-full h-10 rounded-xl bg-yellow-500 hover:bg-yellow-600 disabled:opacity-30 disabled:hover:bg-yellow-500 text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/10 cursor-pointer"
          >
            Confirmar y Resetear Historial
          </button>
          <button
            type="button"
            onClick={() => {
              setShowResetNegocioModal(false);
              setNegocioToReset(null);
              setNegocioResetConfirmText('');
            }}
            className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 hover:text-white text-xs font-bold transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}
