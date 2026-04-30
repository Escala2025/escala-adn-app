/**
 * @fileoverview Módulo de Gestión de Usuarios y Roles.
 * Completamente dinámico: lee y escribe en la tabla `usuarios` de PostgreSQL
 * mediante Server Actions. Exclusivo para roles CEO y TI.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  UserPlus, Search, Shield, Eye, EyeOff, RefreshCw,
  X, Check, User, Phone, Mail, Briefcase, Loader2,
  Pencil, ToggleLeft, ToggleRight, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import {
  obtenerUsuarios, crearUsuario, actualizarUsuario, toggleEstadoUsuario,
} from '@/lib/actions/usuarios-actions';
import { etiquetaRol, generarContrasena, puedeGestionarUsuarios } from '@/lib/utilidades';
import type { Usuario, RolUsuario } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const MATRIZ_PERMISOS: { rol: RolUsuario; acceso: string; modulos: string[] }[] = [
  { rol: 'CEO',           acceso: 'Total',       modulos: ['Panel Principal', 'Usuarios y Roles', 'Directorio del Equipo', 'Gestor de Contraseñas', 'Proveedores', 'Cobros y Pagos', 'Mis Pagos'] },
  { rol: 'TI',            acceso: 'Total',       modulos: ['Panel Principal', 'Usuarios y Roles', 'Directorio del Equipo', 'Gestor de Contraseñas', 'Proveedores', 'Cobros y Pagos', 'Mis Pagos'] },
  { rol: 'Contable',      acceso: 'Amplio',      modulos: ['Panel Principal', 'Directorio del Equipo', 'Gestor de Contraseñas (propias)', 'Proveedores', 'Cobros y Pagos (Tablero)', 'Mis Pagos'] },
  { rol: 'Personal_base', acceso: 'Limitado',    modulos: ['Directorio del Equipo', 'Gestor de Contraseñas (propias)', 'Cobros y Pagos (propios)', 'Mis Pagos'] },
  { rol: 'Proveedor',     acceso: 'Restringido', modulos: ['Cobros y Pagos (propios)', 'Mis Pagos'] },
];

const ROLES_DISPONIBLES: RolUsuario[] = ['CEO', 'TI', 'Contable', 'Personal_base', 'Proveedor'];

const ACCESO_COLOR: Record<string, string> = {
  Total: 'insignia-autorizado',
  Limitado: 'insignia-revision',
  Restringido: 'insignia-pendiente',
};

const ROL_COLORES: Record<RolUsuario, string> = {
  CEO:           'insignia-autorizado',
  TI:            'insignia-revision',
  Contable:      'insignia-pendiente',
  Personal_base: '',
  Proveedor:     'insignia-rechazado',
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIO CREAR / EDITAR USUARIO
// ─────────────────────────────────────────────────────────────────────────────

interface FormularioUsuarioProps {
  usuarioEditar?: Usuario;
  onCerrar: () => void;
  onGuardado: () => void;
}

function FormularioUsuario({ usuarioEditar, onCerrar, onGuardado }: FormularioUsuarioProps) {
  const esEdicion = !!usuarioEditar;
  const [form, setForm] = useState({
    nombreCompleto: usuarioEditar?.nombreCompleto ?? '',
    telefono:       usuarioEditar?.telefono ?? '',
    correo:         usuarioEditar?.correo ?? '',
    cargo:          usuarioEditar?.cargo ?? '',
    rol:            (usuarioEditar?.rol ?? 'Personal_base') as RolUsuario,
    contrasena:     '',
  });
  const [mostrarPass, setMostrarPass] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');

  const actualizar = (campo: string, valor: string) => {
    setForm(p => ({ ...p, [campo]: valor }));
    if (errores[campo]) setErrores(p => ({ ...p, [campo]: '' }));
  };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.nombreCompleto.trim()) e.nombreCompleto = 'Requerido';
    if (!form.correo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) e.correo = 'Correo inválido';
    if (!form.cargo.trim()) e.cargo = 'Requerido';
    if (!esEdicion && (!form.contrasena || form.contrasena.length < 8)) e.contrasena = 'Mínimo 8 caracteres';
    if (form.contrasena && form.contrasena.length > 0 && form.contrasena.length < 8) e.contrasena = 'Mínimo 8 caracteres';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(true);
    setErrorServidor('');

    try {
      let resultado;
      if (esEdicion) {
        resultado = await actualizarUsuario(usuarioEditar.id, {
          nombreCompleto: form.nombreCompleto,
          correo:         form.correo,
          telefono:       form.telefono,
          cargo:          form.cargo,
          rol:            form.rol,
          nuevaContrasena: form.contrasena || undefined,
        });
      } else {
        resultado = await crearUsuario({
          nombreCompleto: form.nombreCompleto,
          correo:         form.correo,
          telefono:       form.telefono,
          cargo:          form.cargo,
          rol:            form.rol,
          contrasena:     form.contrasena,
        });
      }

      if (resultado.ok) {
        onGuardado();
      } else {
        setErrorServidor(resultado.error ?? 'Error desconocido');
      }
    } catch {
      setErrorServidor('Error de conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-fondo" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div
        className="w-full max-w-lg mx-4 rounded-2xl p-6 animar-entrada"
        style={{ backgroundColor: 'white', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>
              {esEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {esEdicion ? 'Modifica los datos del colaborador' : 'Complete los datos del colaborador'}
            </p>
          </div>
          <button onClick={onCerrar} className="p-2 rounded-lg transition-colors hover:bg-gray-100">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {errorServidor && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
            style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
            <AlertCircle size={15} />
            {errorServidor}
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
                <User size={12} className="inline mr-1" /> Nombre Completo *
              </label>
              <input
                value={form.nombreCompleto}
                onChange={e => actualizar('nombreCompleto', e.target.value)}
                placeholder="Ej: María García López"
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: errores.nombreCompleto ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
              {errores.nombreCompleto && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.nombreCompleto}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
                <Phone size={12} className="inline mr-1" /> Teléfono
              </label>
              <input
                value={form.telefono}
                onChange={e => actualizar('telefono', e.target.value)}
                placeholder="3001234567"
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
                <Mail size={12} className="inline mr-1" /> Correo *
              </label>
              <input
                type="email"
                value={form.correo}
                onChange={e => actualizar('correo', e.target.value)}
                placeholder="usuario@escala.edu.co"
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: errores.correo ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
              {errores.correo && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.correo}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
                <Briefcase size={12} className="inline mr-1" /> Cargo *
              </label>
              <input
                value={form.cargo}
                onChange={e => actualizar('cargo', e.target.value)}
                placeholder="Ej: Diseñador Gráfico"
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: errores.cargo ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
              {errores.cargo && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.cargo}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
                <Shield size={12} className="inline mr-1" /> Rol *
              </label>
              <select
                value={form.rol}
                onChange={e => actualizar('rol', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
              >
                {ROLES_DISPONIBLES.map(r => (
                  <option key={r} value={r}>{etiquetaRol(r)}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
                {esEdicion ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña inicial *'}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={mostrarPass ? 'text' : 'password'}
                    value={form.contrasena}
                    onChange={e => actualizar('contrasena', e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm border"
                    style={{ borderColor: errores.contrasena ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setMostrarPass(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2">
                    {mostrarPass
                      ? <EyeOff size={14} style={{ color: 'var(--muted-foreground)' }} />
                      : <Eye size={14} style={{ color: 'var(--muted-foreground)' }} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { const p = generarContrasena(); actualizar('contrasena', p); setMostrarPass(true); }}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                  style={{ backgroundColor: 'rgba(0,122,136,0.1)', color: 'var(--cp)', border: '1px solid rgba(0,122,136,0.2)' }}
                >
                  <RefreshCw size={13} /> Generar
                </button>
              </div>
              {errores.contrasena && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.contrasena}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: 'var(--cp)', color: 'white', opacity: guardando ? 0.7 : 1 }}>
              {guardando
                ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                : <><Check size={15} /> {esEdicion ? 'Actualizar' : 'Crear Usuario'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloUsuarios() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<Usuario | undefined>();
  const [pestana, setPestana] = useState<'lista' | 'matriz'>('lista');
  const [toggling, setToggling] = useState<string | null>(null);

  // Todos los hooks ANTES de cualquier return condicional (reglas de hooks)
  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const resultado = await obtenerUsuarios();
      if (resultado.ok && resultado.datos) {
        setUsuarios(resultado.datos);
      } else {
        setErrorCarga(resultado.error ?? 'Error al cargar usuarios.');
      }
    } catch {
      setErrorCarga('Error de conexión con la base de datos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  const handleGuardado = useCallback(() => {
    setMostrarFormulario(false);
    setUsuarioEditar(undefined);
    cargarUsuarios();
  }, [cargarUsuarios]);

  const handleToggleEstado = useCallback(async (u: Usuario) => {
    setToggling(u.id);
    try {
      const resultado = await toggleEstadoUsuario(u.id, !u.activo);
      if (resultado.ok) {
        setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x));
      }
    } finally {
      setToggling(null);
    }
  }, []);

  /** Guarda de acceso: solo CEO y TI */
  if (!usuario || !puedeGestionarUsuarios(usuario.rol)) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center">
          <Shield size={40} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="font-semibold" style={{ color: 'var(--cd)' }}>Acceso Restringido</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Solo roles CEO y TI pueden gestionar usuarios.
          </p>
        </div>
      </div>
    );
  }

  const usuariosFiltrados = usuarios.filter(u =>
    u.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.correo.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.rol.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>Usuarios y Roles</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Administración de accesos y permisos del equipo
          </p>
        </div>
        <button
          onClick={() => { setUsuarioEditar(undefined); setMostrarFormulario(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ backgroundColor: 'var(--cp)', color: 'white', boxShadow: '0 4px 12px rgba(0,122,136,0.25)' }}
        >
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'rgba(4,40,66,0.06)' }}>
        {(['lista', 'matriz'] as const).map(p => (
          <button key={p} onClick={() => setPestana(p)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: pestana === p ? 'white' : 'transparent',
              color: pestana === p ? 'var(--cd)' : 'var(--muted-foreground)',
              boxShadow: pestana === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {p === 'lista' ? 'Lista de Usuarios' : 'Matriz de Permisos'}
          </button>
        ))}
      </div>

      {pestana === 'lista' ? (
        <>
          {/* Buscador + Recargar */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, correo o rol..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
              />
            </div>
            <button onClick={cargarUsuarios} disabled={cargando}
              className="p-2.5 rounded-xl border transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'white' }}
              title="Recargar datos">
              <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          {/* Estado de carga / error */}
          {cargando ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--cp)' }} />
            </div>
          ) : errorCarga ? (
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ backgroundColor: 'rgba(186,86,40,0.08)', border: '1px solid rgba(186,86,40,0.2)' }}>
              <AlertCircle size={18} style={{ color: 'var(--cs)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--cs)' }}>{errorCarga}</p>
                <button onClick={cargarUsuarios} className="text-xs underline mt-0.5" style={{ color: 'var(--cs)' }}>
                  Reintentar
                </button>
              </div>
            </div>
          ) : (
            /* Tabla */
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(4,40,66,0.04)', borderBottom: '1px solid var(--border)' }}>
                    {['Colaborador', 'Cargo', 'Correo', 'Teléfono', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: 'rgba(0,122,136,0.1)', color: 'var(--cp)' }}>
                            {u.nombreCompleto.split(' ').slice(0, 2).map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium" style={{ color: 'var(--cd)' }}>{u.nombreCompleto}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4" style={{ color: 'var(--muted-foreground)' }}>{u.cargo || '—'}</td>
                      <td className="px-5 py-4 text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{u.correo}</td>
                      <td className="px-5 py-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>{u.telefono || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`insignia-estado ${ROL_COLORES[u.rol] || 'insignia-pendiente'}`}>
                          {etiquetaRol(u.rol)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`insignia-estado ${u.activo ? 'insignia-autorizado' : 'insignia-rechazado'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setUsuarioEditar(u); setMostrarFormulario(true); }}
                            className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                            title="Editar usuario">
                            <Pencil size={13} style={{ color: 'var(--cp)' }} />
                          </button>
                          <button
                            onClick={() => handleToggleEstado(u)}
                            disabled={toggling === u.id || u.id === usuario?.id}
                            className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                            title={u.activo ? 'Desactivar' : 'Activar'}>
                            {toggling === u.id
                              ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                              : u.activo
                              ? <ToggleRight size={15} style={{ color: '#059669' }} />
                              : <ToggleLeft size={15} style={{ color: 'var(--cs)' }} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usuariosFiltrados.length === 0 && !cargando && (
                <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
                  <User size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No se encontraron usuarios</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Matriz de permisos */
        <div className="space-y-3">
          {MATRIZ_PERMISOS.map(item => (
            <div key={item.rol} className="rounded-xl p-4 flex items-start gap-4"
              style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex-shrink-0 pt-0.5">
                <span className={`insignia-estado ${ACCESO_COLOR[item.acceso]}`}>
                  {etiquetaRol(item.rol)}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Acceso {item.acceso}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.modulos.map(m => (
                    <span key={m} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: 'rgba(0,122,136,0.08)', color: 'var(--cp)' }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {mostrarFormulario && (
        <FormularioUsuario
          usuarioEditar={usuarioEditar}
          onCerrar={() => { setMostrarFormulario(false); setUsuarioEditar(undefined); }}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  );
}
