'use client';

import { useState, useEffect } from 'react';
import { mockDb, Sede } from '@/lib/supabaseClient';

export default function SedeConfigPage() {
  const [activeSedeId, setActiveSedeId] = useState('');
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estados para cambio de contraseña
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passSuccessMsg, setPassSuccessMsg] = useState('');
  const [passErrorMsg, setPassErrorMsg] = useState('');

  // Estados para Gestión de Sedes
  const [sedesList, setSedesList] = useState<Sede[]>([]);
  const [showAddSedeModal, setShowAddSedeModal] = useState(false);
  const [newSedeNombre, setNewSedeNombre] = useState('');
  const [newSedeRut, setNewSedeRut] = useState('');
  const [newSedeDireccion, setNewSedeDireccion] = useState('');
  const [sedeSuccessMsg, setSedeSuccessMsg] = useState('');
  const [sedeErrorMsg, setSedeErrorMsg] = useState('');

  const loadSedeConfig = () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const currentSedeId = localStorage.getItem('alico_active_sede') || 'sede-norte';
      setActiveSedeId(currentSedeId);

      // Cargar usuario actual desde sesión primero para filtrar sedes
      const sessionStr = localStorage.getItem('alico_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        const users = mockDb.getUsuarios();
        const found = users.find(u => u.id === session.id);
        if (found) {
          setCurrentUser(found);
          
          // Cargar sedes asociadas al negocio
          const businessSedes = mockDb.getSedes(session.negocio_id);
          setSedesList(businessSedes);
        }

        const sedes = mockDb.getSedes();
        const currentSede = sedes.find(s => s.id === currentSedeId);
        if (currentSede) {
          setNombre(currentSede.nombre || '');
          setRut(currentSede.rut || '');
          setDireccion(currentSede.direccion || '');
        } else {
          setErrorMsg('Sede no encontrada. Intente cambiar de sede o verifique su conexión.');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al cargar la configuración de la sede.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSedeConfig();

    const handleSedeChange = () => {
      loadSedeConfig();
    };
    window.addEventListener('sedeChanged', handleSedeChange);
    return () => {
      window.removeEventListener('sedeChanged', handleSedeChange);
    };
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!nombre.trim()) {
      setErrorMsg('El nombre de la sede es un campo requerido.');
      return;
    }

    try {
      const updated = mockDb.updateSede(activeSedeId, {
        nombre: nombre.trim(),
        rut: rut.trim(),
        direccion: direccion.trim(),
      });

      if (updated) {
        setSuccessMsg('¡Configuración de la sede guardada con éxito!');
        // Disparar evento para actualizar nombre de sede en el layout/sidebar de inmediato
        window.dispatchEvent(new Event('sedeChanged'));
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg('No se pudo guardar la configuración de la sede.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar los cambios en la sede.');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassErrorMsg('');
    setPassSuccessMsg('');

    if (!currentUser) {
      setPassErrorMsg('Sesión de usuario no válida.');
      return;
    }

    if (currentUser.password !== currentPassword) {
      setPassErrorMsg('La contraseña actual es incorrecta.');
      return;
    }

    if (newPassword.length < 4) {
      setPassErrorMsg('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPassErrorMsg('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    try {
      const updated = mockDb.updateUsuario(currentUser.id, {
        password: newPassword.trim()
      });

      if (updated) {
        setPassSuccessMsg('¡Tu contraseña ha sido actualizada con éxito!');
        setCurrentUser(updated);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setPassSuccessMsg(''), 4000);
      } else {
        setPassErrorMsg('No se pudo actualizar la contraseña.');
      }
    } catch (err: any) {
      setPassErrorMsg(err.message || 'Error al cambiar la contraseña.');
    }
  };

  const handleCreateSede = (e: React.FormEvent) => {
    e.preventDefault();
    setSedeErrorMsg('');
    setSedeSuccessMsg('');

    if (!newSedeNombre.trim()) {
      setSedeErrorMsg('El nombre de la sede es requerido.');
      return;
    }

    if (!currentUser || !currentUser.negocio_id) {
      setSedeErrorMsg('Sesión no válida.');
      return;
    }

    try {
      const created = mockDb.addSede({
        negocio_id: currentUser.negocio_id,
        nombre: newSedeNombre.trim(),
        rut: newSedeRut.trim(),
        direccion: newSedeDireccion.trim()
      });

      if (created) {
        setSedeSuccessMsg(`¡Sede "${newSedeNombre}" creada con éxito!`);
        setNewSedeNombre('');
        setNewSedeRut('');
        setNewSedeDireccion('');
        
        // Recargar sedes
        const businessSedes = mockDb.getSedes(currentUser.negocio_id);
        setSedesList(businessSedes);

        // Disparar evento para que el layout actualice el select
        window.dispatchEvent(new Event('sedeChanged'));

        setTimeout(() => {
          setShowAddSedeModal(false);
          setSedeSuccessMsg('');
        }, 1500);
      } else {
        setSedeErrorMsg('No se pudo crear la sede.');
      }
    } catch (err: any) {
      setSedeErrorMsg(err.message || 'Error al crear la sede.');
    }
  };

  const handleDeleteSede = (id: string, nombreSede: string) => {
    setSedeErrorMsg('');
    setSedeSuccessMsg('');

    if (id === activeSedeId) {
      setSedeErrorMsg('No puedes eliminar la sede en la que estás trabajando actualmente. Cambia de sede en el menú lateral primero.');
      setTimeout(() => setSedeErrorMsg(''), 5000);
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la sede "${nombreSede}"?\nSe borrarán todas las mesas, inventarios, movimientos y ventas vinculados.`)) {
      return;
    }

    try {
      const deleted = mockDb.deleteSede(id);
      if (deleted) {
        setSedeSuccessMsg(`¡Sede "${nombreSede}" eliminada con éxito!`);
        
        // Recargar sedes
        const businessSedes = mockDb.getSedes(currentUser.negocio_id);
        setSedesList(businessSedes);

        // Disparar evento para actualizar sidebar
        window.dispatchEvent(new Event('sedeChanged'));
        
        setTimeout(() => setSedeSuccessMsg(''), 4000);
      } else {
        setSedeErrorMsg('No se pudo eliminar la sede.');
      }
    } catch (err: any) {
      setSedeErrorMsg(err.message || 'Error al eliminar la sede.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4 text-center animate-pulse">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500"></div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500">
            Cargando configuración de sede...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Configuración de Sede</h1>
        <p className="text-xs text-zinc-400 font-semibold mt-1">
          Configura la información comercial y fiscal que aparecerá en los tickets para el cliente.
        </p>
      </div>

      {/* Form Card */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 relative overflow-hidden">
        {/* Top gradient detail */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>

        <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-5 flex items-center justify-between">
          <span>Datos de la Sede Activa</span>
          <span className="text-[9px] text-zinc-500 font-semibold lowercase">
            ID: {activeSedeId}
          </span>
        </h3>

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-5 animate-fade-in">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-5 animate-fade-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              Nombre Comercial de la Sede
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Licorera & Bar ALCO-JCCG Norte"
              className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
            />
            <p className="text-[9px] text-zinc-500 mt-1.5 pl-1">
              Nombre de fantasía o del establecimiento tal como se mostrará al público.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* RUT */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                RUT / NIT (Identificación Fiscal)
              </label>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="Ej. 901.234.567-1"
                className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
              />
              <p className="text-[9px] text-zinc-500 mt-1.5 pl-1">
                Número de identificación fiscal para los tickets.
              </p>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                Dirección Física
              </label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej. Avenida Principal #102"
                className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
              />
              <p className="text-[9px] text-zinc-500 mt-1.5 pl-1">
                Ubicación de la sede para el encabezado del tiquete.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end">
            <button
              type="submit"
              className="h-10 px-6 rounded-xl btn-gold font-bold text-xs shadow-lg shadow-amber-500/10 transition-all flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>

      {/* CARD: GESTIÓN DE SEDES (SUCURSALES) */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-5">
          <h3 className="text-xs font-black text-white uppercase tracking-widest">
            Gestión de Sedes (Sucursales)
          </h3>
          <button
            type="button"
            onClick={() => setShowAddSedeModal(true)}
            className="h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Crear Sede
          </button>
        </div>

        {sedeSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-5 animate-fade-in">
            {sedeSuccessMsg}
          </div>
        )}

        {sedeErrorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-5 animate-fade-in">
            {sedeErrorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sedesList.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-xl border relative overflow-hidden flex flex-col justify-between min-h-[120px] transition-all bg-[#0a0a14] ${
                s.id === activeSedeId
                  ? 'border-amber-500/35 shadow-lg shadow-amber-500/5'
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white leading-tight">{s.nombre}</h4>
                  {s.id === activeSedeId && (
                    <span className="h-5 px-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider text-amber-400 flex items-center">
                      Activa
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">RUT: {s.rut || 'No especificado'}</p>
                <p className="text-[10px] text-zinc-400 mt-1.5 leading-relaxed">{s.direccion || 'Sin dirección registrada'}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDeleteSede(s.id, s.nombre)}
                  className={`h-7 px-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 ${
                    s.id === activeSedeId
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-red-950/20 hover:bg-red-900/20 border border-red-900/40 text-red-400'
                  }`}
                  disabled={s.id === activeSedeId}
                  title={s.id === activeSedeId ? 'No puedes borrar tu sede de trabajo activa' : 'Eliminar esta sucursal'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Borrar Sede
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: REGISTRAR NUEVA SEDE */}
      {showAddSedeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass-card border border-white/5 rounded-3xl p-6 md:p-8 w-full max-w-md relative overflow-hidden bg-[#06060c]/95 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>

            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                Registrar Nueva Sede
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSedeModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sedeErrorMsg && (
              <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-5">
                {sedeErrorMsg}
              </div>
            )}

            {sedeSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-5">
                {sedeSuccessMsg}
              </div>
            )}

            <form onSubmit={handleCreateSede} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Nombre de la Sede *
                </label>
                <input
                  type="text"
                  required
                  value={newSedeNombre}
                  onChange={(e) => setNewSedeNombre(e.target.value)}
                  placeholder="Ej. NexuS Sucursal Sur"
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  RUT / NIT (Opcional)
                </label>
                <input
                  type="text"
                  value={newSedeRut}
                  onChange={(e) => setNewSedeRut(e.target.value)}
                  placeholder="Ej. 901.234.567-2"
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Dirección (Opcional)
                </label>
                <input
                  type="text"
                  value={newSedeDireccion}
                  onChange={(e) => setNewSedeDireccion(e.target.value)}
                  placeholder="Ej. Calle 50 #12-45"
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
                />
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSedeModal(false)}
                  className="h-10 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 font-bold text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 rounded-xl btn-gold font-bold text-xs shadow-lg shadow-amber-500/10 transition-all flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Crear Sede
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card de Cambio de Contraseña de Autoservicio */}
      {currentUser && (
        <div className="glass-card rounded-2xl p-6 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>

          <h3 className="text-xs font-black text-white uppercase tracking-widest pb-3 border-b border-white/5 mb-5 flex items-center justify-between">
            <span>Seguridad y Contraseña</span>
            <span className="text-[9px] text-zinc-500 font-semibold lowercase">
              Usuario: {currentUser.email}
            </span>
          </h3>

          {passSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-5 animate-fade-in">
              {passSuccessMsg}
            </div>
          )}

          {passErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-300 text-xs font-semibold mb-5 animate-fade-in">
              {passErrorMsg}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                Contraseña Actual
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Introduce tu contraseña actual"
                className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button
                type="submit"
                className="h-10 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs shadow-lg shadow-emerald-500/10 transition-all flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Actualizar Contraseña
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Info Card */}
      <div className="p-4 bg-zinc-950/40 border border-white/5 rounded-2xl flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.083 1.083l-.041.02a.75.75 0 11-1.083-1.083zM12 8.25a.75.75 0 100-1.5.75.75 0 000 1.5zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-[10px] text-zinc-500 leading-normal">
          <p className="font-bold text-zinc-400">Nota sobre el tiquete térmico:</p>
          <p className="mt-1">
            Los datos configurados aquí se grabarán en la base de datos local y se sincronizarán con Supabase. Cualquier tiquete impreso de venta (POS) o de cierre de caja utilizará esta información en el encabezado.
          </p>
        </div>
      </div>
    </div>
  );
}
