'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mockDb, ensureDbInitialized } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();

  // Estados de Login tradicional (Avanzado)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Estados de Login por Perfil + Seguridad
  const [selectedProfileForPass, setSelectedProfileForPass] = useState<'admin' | 'super' | null>(null);
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passError, setPassError] = useState('');

  // ==============================================================
  // 1. INICIALIZACIÓN DE CREDENCIALES (MODO DEMO)
  // Al arrancar la pantalla de login, validamos si ya existen claves guardadas
  // en localStorage. Si no existen, establecemos los valores por defecto.
  // ==============================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clave inicial para administrador de sede (POS y mesas)
      if (!localStorage.getItem('alico_admin_password')) {
        localStorage.setItem('alico_admin_password', 'admin123');
      }
      // Forzar migración de la clave de Super Admin si tiene valores antiguos almacenados en caché
      const cachedSuperPass = localStorage.getItem('alico_super_password');
      if (!cachedSuperPass || cachedSuperPass === 'jccg2105' || cachedSuperPass === 'jccg2105.') {
        localStorage.setItem('alico_super_password', 'jccg2105@.**');
      }

      // Asegurar que cargamos de Supabase en caliente la base de datos (con las claves y usuarios actuales)
      ensureDbInitialized().catch(err => {
        console.error("❌ [Login] Error cargando usuarios de Supabase:", err);
      });
    }
  }, []);

  // ==============================================================
  // 2. CONTROLADOR: LOGIN TRADICIONAL (EMAIL & PASSWORD)
  // Este controlador maneja el acceso mediante formulario manual.
  // Verifica el correo y la contraseña contra las credenciales dinámicas.
  // ==============================================================
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simula una latencia de red para mejorar la experiencia de usuario (loader)
    setTimeout(() => {
      const cleanEmail = email.toLowerCase().trim();
      const users = mockDb.getUsuarios();
      const foundUser = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);

      if (foundUser) {
        const session = {
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.rol,
          nombre: foundUser.nombre,
          negocio_id: foundUser.negocio_id,
          timestamp: Date.now()
        };
        localStorage.setItem('alico_session', JSON.stringify(session));

        if (foundUser.rol === 'super_admin') {
          router.push('/super-admin');
        } else {
          // Asigna la primera sede de este negocio por defecto
          const sedes = mockDb.getSedes(foundUser.negocio_id);
          const defaultSede = sedes.length > 0 ? sedes[0].id : 'sede-norte';
          localStorage.setItem('alico_active_sede', defaultSede);
          router.push('/dashboard');
        }
      } else {
        setError('Credenciales incorrectas. Intenta de nuevo.');
        setIsLoading(false);
      }
    }, 800);
  };

  // ==============================================================
  // 3. CONTROLADOR: ACCESO RÁPIDO POR PERFIL (MODAL)
  // Permite ingresar haciendo clic directo en el perfil y validando la clave.
  // ==============================================================
  const handleProfilePassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setIsLoading(true);

    setTimeout(() => {
      const users = mockDb.getUsuarios();
      let foundUser = null;

      if (selectedProfileForPass === 'super') {
        foundUser = users.find(u => u.rol === 'super_admin' && u.password === profilePassword);
      } else {
        const cleanEmail = profileEmail.toLowerCase().trim();
        foundUser = users.find(u => 
          ['admin', 'vendedor', 'mesero'].includes(u.rol) && 
          u.email.toLowerCase() === cleanEmail && 
          u.password === profilePassword
        );
      }

      if (foundUser) {
        const session = {
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.rol,
          nombre: foundUser.nombre,
          negocio_id: foundUser.negocio_id,
          timestamp: Date.now()
        };
        localStorage.setItem('alico_session', JSON.stringify(session));

        if (foundUser.rol === 'super_admin') {
          router.push('/super-admin');
        } else {
          const sedes = mockDb.getSedes(foundUser.negocio_id);
          const defaultSede = sedes.length > 0 ? sedes[0].id : 'sede-norte';
          localStorage.setItem('alico_active_sede', defaultSede);
          router.push('/dashboard');
        }
      } else {
        setPassError('Contraseña incorrecta. Inténtalo de nuevo.');
        setIsLoading(false);
      }
    }, 600);
  };

  // Limpia y resetea el modal flotante de contraseña
  const handleCloseModal = () => {
    setSelectedProfileForPass(null);
    setProfilePassword('');
    setProfileEmail('');
    setPassError('');
    setShowPassword(false);
    setIsLoading(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-[#020205]">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-2xl z-10">
        {/* Brand Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 shadow-xl shadow-amber-500/20 mb-4 ring-1 ring-white/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8 text-black">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            NEXUS
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-bold tracking-widest uppercase">
            Plataforma SaaS de Gestión
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Control de Barra, Mesas & Inventario Multisede
          </p>
        </div>

        {/* Profile Selector (Main View) */}
        {!showAdvanced ? (
          <div className="space-y-6">
            <h2 className="text-center text-sm font-semibold tracking-wider text-zinc-400 uppercase mb-4">
              Selecciona tu Perfil para Ingresar
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Admin Sede */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setSelectedProfileForPass('admin');
                  setProfilePassword('');
                  setPassError('');
                  setShowPassword(false);
                }}
                className="group relative text-left glass-card rounded-2xl p-6 border border-white/5 hover:border-emerald-500/30 bg-[#06060c]/50 hover:bg-[#07130e]/30 transition-all duration-300 shadow-xl hover:shadow-emerald-500/5 flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>

                <div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">Administrador</h3>
                  <p className="text-xs text-zinc-500 font-semibold mt-0.5">Gerente de Sede (POS & Mesas)</p>
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                    Acceso directo a la terminal de ventas en barra, mapa interactivo de comandas, inventario Kárdex y cartera.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span>Ingresar al POS</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 transform group-hover:translate-x-1 transition-transform">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </button>

              {/* Card Super Admin */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setSelectedProfileForPass('super');
                  setProfilePassword('');
                  setPassError('');
                  setShowPassword(false);
                }}
                className="group relative text-left glass-card rounded-2xl p-6 border border-white/5 hover:border-amber-500/30 bg-[#06060c]/50 hover:bg-[#140f06]/30 transition-all duration-300 shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>

                <div>
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">Juan Carlos Caridad</h3>
                  <p className="text-xs text-zinc-500 font-semibold mt-0.5">Dueño (Super Administrador)</p>
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                    Consola global consolidada para dueños. Gestión de sucursales, creación de administradores y auditoría contable multisede.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-amber-400">
                  <span>Consola de Dueño</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 transform group-hover:translate-x-1 transition-transform">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Advanced Login View (Traditional Form) */
          <div className="glass-card rounded-2xl p-8 border border-white/5 relative overflow-hidden max-w-md mx-auto">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>

            <h2 className="text-xl font-semibold text-white mb-2">Ingreso Avanzado</h2>
            <p className="text-xs text-zinc-400 mb-6">Formulario de soporte técnico y credenciales personalizadas.</p>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-xs font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-wider uppercase mb-2">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nexus.com"
                  className="w-full h-11 px-4 rounded-xl glass-input text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 tracking-wider uppercase mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-xl glass-input text-sm text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl btn-gold text-sm font-semibold flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black"></div>
                    <span>Verificando...</span>
                  </>
                ) : (
                  <span>Ingresar al Sistema</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Footer Support Links */}
        <div className="text-center mt-10">
          <button
            type="button"
            onClick={() => {
              setShowAdvanced(!showAdvanced);
              setError('');
              setIsLoading(false);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold underline underline-offset-4 transition-colors cursor-pointer"
          >
            {showAdvanced ? "← Volver al Ingreso por Perfiles" : "Ingreso Avanzado (Soporte)"}
          </button>

          <p className="text-center text-[10px] text-zinc-600 mt-6 tracking-wide">
            NexuS SaaS v1.1.0 • Control y Gestión Multisede
          </p>
        </div>
      </div>

      {/* Modern Glassmorphic Password Validation Modal */}
      {selectedProfileForPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div
            className={`glass-card border rounded-3xl p-6 md:p-8 w-full max-w-sm relative overflow-hidden bg-[#06060c]/95 text-center shadow-2xl transition-all duration-300 ${selectedProfileForPass === 'admin'
              ? 'border-emerald-500/25 shadow-emerald-500/5'
              : 'border-amber-500/25 shadow-amber-500/5'
              }`}
          >
            {/* Ambient Profile Glow */}
            <div
              className={`absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none ${selectedProfileForPass === 'admin' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
            ></div>

            {/* Profile Avatar Icon inside Modal */}
            <div className="flex justify-center mb-4">
              <div
                className={`h-16 w-16 rounded-2xl flex items-center justify-center border shadow-lg transition-transform duration-300 scale-105 ${selectedProfileForPass === 'admin'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10'
                  }`}
              >
                {selectedProfileForPass === 'admin' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <h3 className="text-xl font-bold text-white mb-1">
              {selectedProfileForPass === 'admin' ? 'Administrador' : 'Juan Carlos Caridad'}
            </h3>
            <p className={`text-xs font-bold uppercase tracking-wider mb-6 ${selectedProfileForPass === 'admin' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
              {selectedProfileForPass === 'admin' ? 'Control de Sede (POS)' : 'Acceso Propietario'}
            </p>

            {/* Error Message */}
            {passError && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>{passError}</span>
              </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleProfilePassSubmit} className="space-y-4">
              {selectedProfileForPass === 'admin' && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-left mb-1.5 pl-1">
                    Correo Electrónico (Email)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-zinc-500">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      required
                      autoFocus
                      disabled={isLoading}
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="admin@tu-establecimiento.com"
                      className="w-full h-10 pl-10 pr-3 rounded-xl glass-input text-xs text-white transition-all focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-left mb-1.5 pl-1">
                  Introduce tu Contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-zinc-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoFocus={selectedProfileForPass !== 'admin'}
                    required
                    disabled={isLoading}
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full h-10 pl-10 pr-10 rounded-xl glass-input text-xs text-white transition-all ${selectedProfileForPass === 'admin' ? 'focus:ring-emerald-500' : 'focus:ring-amber-500'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.664 9.576a13.91 13.91 0 0118.673 0 .75.75 0 010 1.148 13.91 13.91 0 01-18.673 0 .75.75 0 010-1.148zM2.086 10a12.41 12.41 0 0015.828 0 12.41 12.41 0 00-15.828 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38.75.75 0 000-.596 11.963 11.963 0 00-18.82 0 .75.75 0 000 .596 9.99 9.99 0 003.3 4.38L3.28 2.22zM8.49 5.867L10.37 7.75a2.5 2.5 0 013.38 3.38l1.884 1.883a4 4 0 00-5.143-5.143L8.49 5.867z" clipRule="evenodd" />
                        <path d="M12.49 14.61l-1.545-1.546a2.5 2.5 0 01-3.38-3.38L6.017 8.136a4 4 0 005.143 5.143L12.49 14.61z" />
                        <path d="M17.16 15.039L2.84 2.84" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-black/30 ${selectedProfileForPass === 'admin'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/5'
                    : 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/5'
                    }`}
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black"></div>
                      <span>Verificando Clave...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h16.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <span>Validar y Entrar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleCloseModal}
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

