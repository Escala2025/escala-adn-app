'use client';

/**
 * @fileoverview Panel de perfil del usuario.
 * Permite editar nombre visible, foto de avatar y ver/cerrar sesiones propias.
 * Se abre como un drawer/modal desde el header.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/contexto-auth';
import {
  actualizarNombreVisible,
  actualizarFotoPerfil,
  obtenerPerfil,
} from '@/lib/actions/perfil-actions';
import {
  listarSesionesActivas,
  cerrarSesionRemota,
  cerrarTodasLasSesiones,
  type SesionActiva,
} from '@/lib/actions/sesiones-actions';
import { verificarYCambiarContrasena } from '@/lib/actions/auth-actions';

// ─────────────────────────────────────────────────────────────────────────────
// ICONOS
// ─────────────────────────────────────────────────────────────────────────────

const IcoCamera    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IcoEdit      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoMonitor   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IcoLlave     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const IcoCheck     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoX         = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoClose     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoEye       = ({ v }: { v: boolean }) => v
  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ nombre, fotoUrl, tamano = 80 }: { nombre: string; fotoUrl?: string; tamano?: number }) {
  const iniciales = nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const size = `${tamano}px`;

  if (fotoUrl) {
    return (
      <img src={fotoUrl} alt={`Foto de ${nombre}`}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white select-none"
      style={{ width: size, height: size, backgroundColor: 'var(--cd)', fontSize: tamano * 0.35 }}>
      {iniciales}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN: INFO DE PERFIL + FOTO + NOMBRE VISIBLE
// ─────────────────────────────────────────────────────────────────────────────

function SeccionPerfil() {
  const { usuario, cerrarSesion } = useAuth();
  const [nombreVisible, setNombreVisible] = useState(usuario?.nombreVisible ?? usuario?.nombreCompleto ?? '');
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [subiendoFoto, setSubiendoFoto]   = useState(false);
  const [fotoUrl, setFotoUrl]             = useState(usuario?.fotoUrl ?? '');
  const [error, setError]                 = useState('');
  const [exito, setExito]                 = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Sincronizar con datos frescos de BD al montar
  useEffect(() => {
    if (!usuario) return;
    obtenerPerfil(usuario.id).then(res => {
      if (res.ok && res.usuario) {
        setNombreVisible(res.usuario.nombreVisible ?? res.usuario.nombreCompleto);
        setFotoUrl(res.usuario.fotoUrl ?? '');
      }
    }).catch(() => null);
  }, [usuario]);

  if (!usuario) return null;

  const mostrarExito = (msg: string) => {
    setExito(msg); setTimeout(() => setExito(''), 3000);
  };

  const guardarNombre = async () => {
    const nombre = nombreVisible.trim();
    if (!nombre) return;
    setGuardandoNombre(true); setError('');
    try {
      const res = await actualizarNombreVisible(usuario.id, nombre);
      if (!res.ok) { setError(res.error ?? 'Error al guardar.'); return; }
      setEditandoNombre(false);
      mostrarExito('Nombre actualizado correctamente.');
      // Actualizar localStorage para reflejar el cambio en la sesión
      const sesion = JSON.parse(localStorage.getItem('escala_sesion') ?? '{}');
      localStorage.setItem('escala_sesion', JSON.stringify({ ...sesion, nombreVisible: nombre }));
    } finally { setGuardandoNombre(false); }
  };

  const manejarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      setError('Solo se permiten imágenes (JPG, PNG, WEBP).'); return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar 2 MB.'); return;
    }

    setSubiendoFoto(true); setError('');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        const res = await actualizarFotoPerfil(usuario.id, dataUrl);
        if (!res.ok) { setError(res.error ?? 'Error al subir la foto.'); setSubiendoFoto(false); return; }
        setFotoUrl(dataUrl);
        const sesion = JSON.parse(localStorage.getItem('escala_sesion') ?? '{}');
        localStorage.setItem('escala_sesion', JSON.stringify({ ...sesion, fotoUrl: dataUrl }));
        mostrarExito('Foto actualizada correctamente.');
        setSubiendoFoto(false);
      };
      reader.readAsDataURL(archivo);
    } catch { setSubiendoFoto(false); }
  };

  const eliminarFoto = async () => {
    setSubiendoFoto(true); setError('');
    try {
      const res = await actualizarFotoPerfil(usuario.id, null);
      if (!res.ok) { setError(res.error ?? 'Error.'); return; }
      setFotoUrl('');
      const sesion = JSON.parse(localStorage.getItem('escala_sesion') ?? '{}');
      localStorage.setItem('escala_sesion', JSON.stringify({ ...sesion, fotoUrl: undefined }));
      mostrarExito('Foto eliminada.');
    } finally { setSubiendoFoto(false); }
  };

  const etiquetasRol: Record<string, string> = {
    CEO: 'CEO', TI: 'TI', Contable: 'Contable',
    Personal_base: 'Personal Base', Proveedor: 'Proveedor',
  };

  return (
    <div className="space-y-6">
      {/* Avatar + datos */}
      <div className="flex flex-col items-center gap-4 pt-2">
        <div className="relative">
          <Avatar nombre={usuario.nombreCompleto} fotoUrl={fotoUrl || undefined} tamano={80} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={subiendoFoto}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--cp)' }}
            title="Cambiar foto"
          >
            {subiendoFoto
              ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              : <IcoCamera />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={manejarFoto} />
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-[var(--cd)]">{usuario.nombreCompleto}</p>
          <p className="text-xs text-gray-400">{usuario.correo}</p>
          <span className="inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: 'var(--cp)' }}>
            {etiquetasRol[usuario.rol] ?? usuario.rol}
          </span>
        </div>

        {fotoUrl && (
          <button onClick={eliminarFoto} disabled={subiendoFoto}
            className="text-xs text-gray-400 hover:text-red-500 underline transition-colors">
            Eliminar foto
          </button>
        )}
      </div>

      {/* Feedback */}
      {error  && <div className="px-3 py-2 rounded-lg bg-red-50 text-xs text-red-700 font-medium">{error}</div>}
      {exito  && <div className="px-3 py-2 rounded-lg bg-emerald-50 text-xs text-emerald-700 font-medium flex items-center gap-1.5"><IcoCheck />{exito}</div>}

      {/* Nombre visible */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--cd)]">Nombre visible</label>
        {editandoNombre ? (
          <div className="flex gap-2">
            <input
              type="text" value={nombreVisible}
              onChange={e => setNombreVisible(e.target.value)}
              maxLength={60}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--cp)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]"
              onKeyDown={e => { if (e.key === 'Enter') guardarNombre(); if (e.key === 'Escape') setEditandoNombre(false); }}
              autoFocus
            />
            <button onClick={guardarNombre} disabled={guardandoNombre}
              className="px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: 'var(--cp)' }}>
              {guardandoNombre ? '...' : <IcoCheck />}
            </button>
            <button onClick={() => { setEditandoNombre(false); setNombreVisible(usuario.nombreVisible ?? usuario.nombreCompleto); }}
              className="px-3 py-2 rounded-lg border border-[var(--clm)] text-sm text-[var(--cd)] hover:bg-[var(--cl)] transition-colors">
              <IcoX />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--clm)] bg-[var(--cl)]">
            <span className="text-sm text-[var(--cd)]">{nombreVisible || usuario.nombreCompleto}</span>
            <button onClick={() => setEditandoNombre(true)}
              className="text-[var(--cp)] hover:opacity-70 transition-opacity ml-2">
              <IcoEdit />
            </button>
          </div>
        )}
        <p className="text-[10px] text-gray-400">Este es el nombre que se mostrara en la plataforma.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN: CAMBIAR CONTRASEÑA
// ─────────────────────────────────────────────────────────────────────────────

function SeccionContrasena() {
  const { usuario } = useAuth();
  const [actual, setActual]       = useState('');
  const [nueva, setNueva]         = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva]   = useState(false);
  const [error, setError]         = useState('');
  const [exito, setExito]         = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (nueva.length < 8)        { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (nueva !== confirmar)     { setError('Las contraseñas no coinciden.'); return; }
    if (!usuario) return;
    setError(''); setGuardando(true);
    try {
      const res = await verificarYCambiarContrasena(usuario.id, actual, nueva);
      if (!res.ok) { setError(res.error ?? 'Error al cambiar la contraseña.'); return; }
      setExito(true); setActual(''); setNueva(''); setConfirmar('');
      setTimeout(() => setExito(false), 3000);
    } finally { setGuardando(false); }
  };

  const campo = (
    label: string, val: string, onChange: (v: string) => void,
    ver: boolean, setVer: (b: boolean) => void
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--cd)]">{label}</label>
      <div className="relative">
        <input type={ver ? 'text' : 'password'} value={val} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
        <button type="button" onClick={() => setVer(!ver)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--cp)] transition-colors">
          <IcoEye v={ver} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {campo('Contraseña actual',       actual,   setActual,   verActual, setVerActual)}
      {campo('Nueva contraseña',        nueva,    setNueva,    verNueva,  setVerNueva)}
      {campo('Confirmar nueva',         confirmar, setConfirmar, false, () => {})}
      {error  && <p className="text-xs text-red-600">{error}</p>}
      {exito  && <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium"><IcoCheck />Contraseña actualizada correctamente.</div>}
      <button onClick={guardar} disabled={guardando || !actual || !nueva || !confirmar}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: 'var(--cp)' }}>
        {guardando ? 'Guardando...' : 'Actualizar contraseña'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN: MIS SESIONES
// ─────────────────────────────────────────────────────────────────────────────

function SeccionSesiones() {
  const { usuario } = useAuth();
  const [sesiones, setSesiones]   = useState<SesionActiva[]>([]);
  const [cargando, setCargando]   = useState(false);
  const [cerrando, setCerrando]   = useState<string | null>(null);
  const [mensaje,  setMensaje]    = useState('');

  const jtiActual = typeof window !== 'undefined'
    ? (JSON.parse(localStorage.getItem('escala_sesion') ?? '{}').jti ?? undefined)
    : undefined;

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      const res = await listarSesionesActivas(usuario.id, jtiActual);
      if (res.ok) setSesiones(res.datos);
    } finally { setCargando(false); }
  }, [usuario, jtiActual]);

  useEffect(() => { cargar(); }, [cargar]);

  const cerrarUna = async (id: string) => {
    if (!usuario) return;
    setCerrando(id);
    try {
      const res = await cerrarSesionRemota(id, usuario.id);
      if (res.ok) {
        setSesiones(prev => prev.filter(s => s.id !== id));
        setMensaje('Sesion cerrada.'); setTimeout(() => setMensaje(''), 2500);
      }
    } finally { setCerrando(null); }
  };

  const cerrarTodas = async () => {
    if (!usuario) return;
    const res = await cerrarTodasLasSesiones(usuario.id, jtiActual);
    if (res.ok) {
      setSesiones(prev => prev.filter(s => s.esSesionActual));
      setMensaje('Todas las otras sesiones han sido cerradas.'); setTimeout(() => setMensaje(''), 3000);
    }
  };

  if (cargando) return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="space-y-3">
      {mensaje && <div className="px-3 py-2 rounded-lg bg-emerald-50 text-xs text-emerald-700 font-medium">{mensaje}</div>}

      {sesiones.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="flex justify-center mb-2 text-gray-300"><IcoMonitor /></div>
          <p className="text-xs">Sin sesiones activas registradas.</p>
          <p className="text-[10px] mt-1">Inicia sesion nuevamente para que aparezca aqui.</p>
        </div>
      ) : (
        <>
          {sesiones.length > 1 && (
            <button onClick={cerrarTodas}
              className="w-full py-2 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium">
              Cerrar todas las otras sesiones
            </button>
          )}
          <div className="space-y-2">
            {sesiones.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--clm)] bg-[var(--cl)]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-[var(--cp)] shrink-0"><IcoMonitor /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-[var(--cd)] truncate">
                        {s.nombreDispositivo ?? 'Dispositivo desconocido'}
                      </p>
                      {s.esSesionActual && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: 'var(--cp)' }}>
                          Esta sesion
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {new Date(s.creadoEn).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {!s.esSesionActual && (
                  <button onClick={() => cerrarUna(s.id)} disabled={cerrando === s.id}
                    className="shrink-0 text-[10px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    {cerrando === s.id ? '...' : 'Cerrar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

interface PanelPerfilProps {
  abierto: boolean;
  onCerrar: () => void;
}

export default function PanelPerfil({ abierto, onCerrar }: PanelPerfilProps) {
  const [tab, setTab] = useState<'perfil' | 'contrasena' | 'sesiones'>('perfil');

  if (!abierto) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onCerrar} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col"
        style={{ borderLeft: '1px solid var(--clm)' }}>
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--clm)' }}>
          <h2 className="text-base font-bold text-[var(--cd)]">Mi Perfil</h2>
          <button onClick={onCerrar}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-[var(--cl)] hover:text-[var(--cd)] transition-colors">
            <IcoClose />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-4 pt-3 pb-0 shrink-0" style={{ borderBottom: '1px solid var(--clm)' }}>
          {([
            { id: 'perfil',     label: 'Perfil',     Ico: IcoCamera  },
            { id: 'contrasena', label: 'Contraseña', Ico: IcoLlave   },
            { id: 'sesiones',   label: 'Sesiones',   Ico: IcoMonitor },
          ] as const).map(({ id, label, Ico }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 pb-3 text-xs font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-[var(--cp)] text-[var(--cp)]'
                  : 'border-transparent text-gray-400 hover:text-[var(--cd)]'
              }`}>
              <Ico />{label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === 'perfil'     && <SeccionPerfil />}
          {tab === 'contrasena' && <SeccionContrasena />}
          {tab === 'sesiones'   && <SeccionSesiones />}
        </div>
      </div>
    </>
  );
}
