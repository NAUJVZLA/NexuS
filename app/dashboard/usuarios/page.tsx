'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mockDb, Usuario } from '@/lib/supabaseClient';

export default function UsuariosPage() {
  const router = useRouter();
  
  // Lista de usuarios y sesión
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState('');
  const [activeNegocioId, setActiveNegocioId] = useState('');
  const [subdominio, setSubdominio] = useState('alcobar');
  const [loading, setLoading] = useState(true);
  
  // Modals y estados del formulario
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  
  // Inputs del formulario
  const [nombreInput, setNombreInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [rolInput, setRolInput] = useState<'admin' | 'vendedor' | 'mesero'>('mesero');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadUsuarios = () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const sessionStr = localStorage.getItem('alico_session');
      if (!sessionStr) {
        router.replace('/login');
        return;
      }
      
      const session = JSON.parse(sessionStr);
      if (session.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }
      
      setCurrentAdminId(session.id);
      setActiveNegocioId(session.negocio_id);

      // Obtener el negocio para saber su subdominio
      const negocio = mockDb.getNegocios().find(n => n.id === session.negocio_id);
      if (negocio && negocio.subdominio) {
        setSubdominio(negocio.subdominio);
      }
      
      // Obtener usuarios del negocio
      const allUsers = mockDb.getUsuarios();
      const filtered = allUsers.filter(u => u.negocio_id === session.negocio_id);
      setUsuarios(filtered);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al cargar la lista de personal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsuarios();
  }, []);

  const closeForm = () => {
    setShowAddModal(false);
    setEditingUser(null);
    setNombreInput('');
    setEmailInput('');
    setPasswordInput('');
    setRolInput('mesero');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleOpenEdit = (user: Usuario) => {
    setEditingUser(user);
    setNombreInput(user.nombre);
    
    // Separar el prefijo del correo electrónico (quitar el @dominio)
    const emailPrefix = user.email.split('@')[0] || '';
    setEmailInput(emailPrefix);
    
    setPasswordInput(user.password || '');
    setRolInput(user.rol as any);
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPrefix = emailInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nombreInput.trim() || !cleanPrefix || !passwordInput.trim()) {
      setErrorMsg('Todos los campos obligatorios deben ser completados.');
      return;
    }

    if (passwordInput.trim().length < 4) {
      setErrorMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    const generatedEmail = `${cleanPrefix}@${subdominio}.com`;

    try {
      // Verificar si el email ya existe en la base de datos global
      const allUsers = mockDb.getUsuarios();
      const emailExists = allUsers.some(u => u.email.toLowerCase() === generatedEmail && u.id !== editingUser?.id);
      
      if (emailExists) {
        setErrorMsg('Este nombre de usuario ya se encuentra registrado.');
        return;
      }

      if (editingUser) {
        // Editar usuario existente
        const updated = mockDb.updateUsuario(editingUser.id, {
          nombre: nombreInput.trim(),
          email: generatedEmail,
          password: passwordInput.trim(),
          rol: rolInput
        });
        
        if (updated) {
          setSuccessMsg(`¡Usuario "${nombreInput}" actualizado con éxito!`);
          
          // Registrar en bitácora de auditoría
          const session = JSON.parse(localStorage.getItem('alico_session') || '{}');
          mockDb.registrarAuditLog(
            'global-system',
            session.nombre || 'Admin',
            'EDICION_USUARIO',
            `Editado usuario de personal: ${generatedEmail} (${rolInput})`
          );
        } else {
          setErrorMsg('No se pudo actualizar el usuario.');
        }
      } else {
        // Crear nuevo usuario de personal
        const newUser: Usuario = {
          id: 'u-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          negocio_id: activeNegocioId,
          nombre: nombreInput.trim(),
          email: generatedEmail,
          password: passwordInput.trim(),
          rol: rolInput
        };

        mockDb.addUsuario(newUser);
        setSuccessMsg(`¡Usuario "${nombreInput}" creado con éxito!`);
        
        // Registrar en bitácora
        const session = JSON.parse(localStorage.getItem('alico_session') || '{}');
        mockDb.registrarAuditLog(
          'global-system',
          session.nombre || 'Admin',
          'CREACION_USUARIO',
          `Creado usuario de personal: ${generatedEmail} (${rolInput})`
        );
      }

      loadUsuarios();
      setTimeout(() => {
        closeForm();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el usuario de personal.');
    }
  };

  const handleDeleteUser = (id: string, email: string) => {
    if (id === currentAdminId) {
      alert('Seguridad del sistema: No puedes eliminar tu propio usuario de administrador en sesión.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${email}? No podrá volver a ingresar al sistema.`)) {
      return;
    }

    try {
      const res = mockDb.deleteUsuario(id);
      if (res) {
        // Registrar en bitácora
        const session = JSON.parse(localStorage.getItem('alico_session') || '{}');
        mockDb.registrarAuditLog(
          'global-system',
          session.nombre || 'Admin',
          'ELIMINACION_USUARIO',
          `Eliminado acceso del usuario de personal: ${email}`
        );
        
        setSuccessMsg('Usuario eliminado con éxito.');
        loadUsuarios();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        alert('No se pudo eliminar el usuario.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el usuario.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Gestión de Personal</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Administra los usuarios de acceso para tus Vendedores y Meseros.
          </p>
        </div>
        <button
          onClick={() => {
            closeForm();
            setShowAddModal(true);
          }}
          className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Registrar Personal
        </button>
      </div>

      {successMsg && !showAddModal && (
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold animate-fade-in">
          {successMsg}
        </div>
      )}

      {/* Grid de Personal */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] animate-pulse">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500 mb-3"></div>
          <p className="text-xs text-zinc-500 font-semibold">Cargando personal de la empresa...</p>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center border border-white/5 bg-[#06060c]/40">
          <p className="text-sm text-zinc-400 font-bold">No tienes personal registrado.</p>
          <p className="text-xs text-zinc-500 mt-1">Registra meseros y vendedores para que accedan al sistema con sus roles respectivos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {usuarios.map((u) => {
            const isSelf = u.id === currentAdminId;
            return (
              <div 
                key={u.id} 
                className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4 relative overflow-hidden bg-[#06060c]/60"
              >
                {/* Visual indicator bar */}
                <div 
                  className={`absolute top-0 left-0 w-full h-[2px] ${
                    u.rol === 'admin' 
                      ? 'bg-amber-500' 
                      : u.rol === 'vendedor' 
                      ? 'bg-blue-500' 
                      : 'bg-purple-500'
                  }`}
                />

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="truncate">
                      <h3 className="text-xs font-black text-white truncate flex items-center gap-1.5">
                        {u.nombre}
                        {isSelf && (
                          <span className="text-[7.5px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-1 rounded font-normal lowercase">
                            tú
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-zinc-500 truncate font-mono mt-0.5">{u.email}</p>
                    </div>

                    <span 
                      className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ${
                        u.rol === 'admin' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' 
                          : u.rol === 'vendedor' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' 
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                      }`}
                    >
                      {u.rol === 'admin' ? 'Administrador' : u.rol === 'vendedor' ? 'Vendedor POS' : 'Mesero'}
                    </span>
                  </div>

                  <div className="bg-black/35 rounded-xl p-3 border border-white/5 text-left">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Credencial de Ingreso</p>
                    <p className="text-xs text-white mt-1 font-mono flex items-center gap-1.5 select-all">
                      <span>••••••••</span>
                      <span className="text-[9px] text-zinc-500 font-normal">({u.password})</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="flex-1 h-8 rounded-lg bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                    </svg>
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id, u.email)}
                    disabled={isSelf}
                    className="flex-1 h-8 rounded-lg bg-red-950/20 hover:bg-red-900/30 border border-red-500/15 disabled:opacity-20 text-red-400 hover:text-red-300 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3a.75.75 0 000 1.5h1v10A2.25 2.25 0 006.25 17.75h7.5A2.25 2.25 0 0016 15.5v-10h1a.75.75 0 000-1.5h-3v-.25A2.75 2.75 0 0011.25 1h-2.5zM8 4h4v-.25a1.25 1.25 0 00-1.25-1.25h-2.5A1.25 1.25 0 008 3.75V4zM5.5 5.5h9v10a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-10z" clipRule="evenodd" />
                    </svg>
                    Dar de Baja
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORMULARIO PERSONAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card border border-white/10 shadow-2xl rounded-3xl p-6 md:p-8 w-full max-w-sm relative overflow-hidden bg-[#06060c]/95">
            <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none bg-amber-500"></div>

            <div className="text-center mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {editingUser ? 'Editar Miembro de Personal' : 'Registrar Miembro de Personal'}
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1">
                {editingUser ? `Modificando credenciales de: ${editingUser.email}` : 'Crea un nuevo usuario de acceso para el POS.'}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/25 text-red-300 text-xs font-semibold mb-4 leading-normal">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 text-emerald-300 text-xs font-semibold mb-4 leading-normal">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={nombreInput}
                  onChange={(e) => setNombreInput(e.target.value)}
                  placeholder="Ej. Diana Barra"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Nombre de Usuario / Correo de Ingreso *
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="ej. diana"
                    className="w-full h-9 pl-3 pr-28 rounded-lg glass-input text-xs text-white font-mono"
                  />
                  <span className="absolute right-3 text-[11px] text-zinc-500 font-black font-mono pointer-events-none select-none">
                    @{subdominio}.com
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Contraseña de Acceso
                </label>
                <input
                  type="text"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full h-9 px-3 rounded-lg glass-input text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
                  Rol en el Establecimiento
                </label>
                <select
                  value={rolInput}
                  onChange={(e) => setRolInput(e.target.value as any)}
                  className="w-full h-9 px-2 rounded-lg glass-input text-xs text-white bg-zinc-950 border border-white/10"
                >
                  <option value="mesero">MESERO (Solo mapa de mesas y comandas)</option>
                  <option value="vendedor">VENDEDOR (Acceso a ventas POS y mesas)</option>
                  <option value="admin">ADMINISTRADOR (Acceso total del negocio)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  {editingUser ? 'Guardar Cambios' : 'Registrar y Habilitar'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
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
