'use client';

/**
 * @fileoverview Módulo de Auditoría de Acciones.
 * Solo visible para CEO y TI.
 * Muestra el registro completo de eventos del sistema con filtros.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listarAcciones,
  type AccionAuditoria,
} from '@/lib/actions/auditoria-actions';
import { MODULOS_AUDITORIA } from '@/lib/constantes-auditoria';
import {
  listarTodasLasSesiones,
  cerrarSesionRemota,
  cerrarTodasLasSesiones,
} from '@/lib/actions/sesiones-actions';
import { useAuth } from '@/lib/contexto-auth';

// ─────────────────────────────────────────────────────────────────────────────
// ICONOS
// ─────────────────────────────────────────────────────────────────────────────

const IcoShield    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoMonitor   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IcoFiltro    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
const IcoRefresh   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const IcoCerrar    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoX         = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const COLORES_ACCION: Record<string, string> = {
  login:                   'bg-blue-100 text-blue-700',
  crear:                   'bg-emerald-100 text-emerald-700',
  actualizar:              'bg-amber-100 text-amber-700',
  actualizar_nombre_visible: 'bg-amber-100 text-amber-700',
  actualizar_foto:         'bg-amber-100 text-amber-700',
  eliminar:                'bg-red-100 text-red-700',
  aprobar:                 'bg-emerald-100 text-emerald-700',
  rechazar:                'bg-red-100 text-red-700',
  cerrar_sesion_remota:    'bg-orange-100 text-orange-700',
  cerrar_todas_sesiones:   'bg-orange-100 text-orange-700',
};

function colorAccion(accion: string): string {
  const key = Object.keys(COLORES_ACCION).find(k => accion.includes(k));
  return key ? COLORES_ACCION[key] : 'bg-gray-100 text-gray-600';
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-MÓDULO: SESIONES ACTIVAS
// ─────────────────────────="────────────────────────────────────────────────────

type SesionConUsuario = {
  id: string; jti: string; ipOrigen: string | null; userAgent: string | null;
  nombreDispositivo: string | null; creadoEn: string; expiraEn: string;
  activo: boolean; esSesionActual: boolean;
  nombreUsuario: string; correo: string; rol: string;
};

function PanelSesiones() {
  const { usuario } = useAuth();
  const [sesiones,   setSesiones]   = useState<SesionConUsuario[]>([]);
  const [cargando,   setCargando]   = useState(false);
  const [cerrando,   setCerrando]   = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [mensaje,    setMensaje]    = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listarTodasLasSesiones();
      if (res.ok) setSesiones(res.datos as SesionConUsuario[]);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cerrarUna = async (id: string) => {
    if (!usuario) return;
    setCerrando(id);
    try {
      const res = await cerrarSesionRemota(id, usuario.id);
      if (res.ok) {
        setSesiones(prev => prev.filter(s => s.id !== id));
        setMensaje({ tipo: 'ok', texto: 'Sesión cerrada correctamente.' });
      } else {
        setMensaje({ tipo: 'err', texto: res.error ?? 'Error al cerrar.' });
      }
    } finally { setCerrando(null); setTimeout(() => setMensaje(null), 3000); }
  };

  const cerrarTodas = async () => {
    if (!usuario) return;
    const res = await cerrarTodasLasSesiones(usuario.id);
    if (res.ok) {
      setSesiones([]);
      setMensaje({ tipo: 'ok', texto: 'Todas las sesiones han sido cerradas.' });
    } else {
      setMensaje({ tipo: 'err', texto: res.error ?? 'Error.' });
    }
    setConfirmAll(false);
    setTimeout(() => setMensaje(null), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--cd)]">Sesiones Activas</h2>
          <p className="text-sm text-gray-500">Dispositivos con sesión abierta en este momento.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--clm)] text-[var(--cd)] hover:bg-[var(--cl)] transition-colors">
            <IcoRefresh />Actualizar
          </button>
          {sesiones.length > 0 && (
            <button onClick={() => setConfirmAll(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
              <IcoCerrar />Cerrar todas
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className={`p-3 rounded-lg text-sm font-medium ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje.texto}
        </div>
      )}

      {confirmAll && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700 mb-3">
            Esta accion cerrara todas las sesiones activas en el sistema. Confirma para continuar.
          </p>
          <div className="flex gap-2">
            <button onClick={cerrarTodas}
              className="px-4 py-2 text-sm rounded-lg text-white font-semibold"
              style={{ backgroundColor: 'var(--cs)' }}>
              Confirmar cierre
            </button>
            <button onClick={() => setConfirmAll(false)}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--clm)] text-[var(--cd)] hover:bg-[var(--cl)] transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }} />
        </div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="flex justify-center mb-3 text-gray-300"><IcoMonitor /></div>
          <p className="text-sm">No hay sesiones activas registradas.</p>
          <p className="text-xs mt-1">Las sesiones aparecen al iniciar sesion desde la nueva arquitectura.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sesiones.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-[var(--clm)] p-4 flex items-start justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--cl)', color: 'var(--cp)' }}>
                  <IcoMonitor />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--cd)]">
                      {s.nombreDispositivo ?? 'Dispositivo desconocido'}
                    </p>
                    {s.esSesionActual && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: 'var(--cp)' }}>
                        Sesion actual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.nombreUsuario} &mdash; <span style={{ color: 'var(--cp)' }}>{s.rol}</span>
                  </p>
                  <p className="text-xs text-gray-400">{s.correo}</p>
                  {s.ipOrigen && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">IP: {s.ipOrigen}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Iniciada: {formatearFecha(s.creadoEn)}
                  </p>
                </div>
              </div>
              {!s.esSesionActual && (
                <button
                  onClick={() => cerrarUna(s.id)}
                  disabled={cerrando === s.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {cerrando === s.id ? (
                    <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin border-red-500" />
                  ) : <IcoX />}
                  Cerrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-MÓDULO: LOG DE AUDITORÍA
// ─────────────────────────────────────────────────────────────────────────────

function PanelAuditoria() {
  const [acciones,    setAcciones]    = useState<AccionAuditoria[]>([]);
  const [cargando,    setCargando]    = useState(false);
  const [filtroMod,   setFiltroMod]   = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [pagina,      setPagina]      = useState(0);
  const POR_PAGINA = 50;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listarAcciones({ modulo: filtroMod || undefined, limite: POR_PAGINA, offset: pagina * POR_PAGINA });
      if (res.ok) setAcciones(res.datos);
    } finally { setCargando(false); }
  }, [filtroMod, pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = acciones.filter(a =>
    !filtroTexto ||
    a.nombreUsuario?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
    a.descripcion?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
    a.accion.toLowerCase().includes(filtroTexto.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--cd)]">Registro de Actividad</h2>
          <p className="text-sm text-gray-500">Cada accion importante queda registrada aqui con fecha, hora y responsable.</p>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--clm)] text-[var(--cd)] hover:bg-[var(--cl)] transition-colors">
          <IcoRefresh />Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--clm)] bg-white text-sm text-[var(--cd)]">
          <IcoFiltro />
          <select value={filtroMod} onChange={e => { setFiltroMod(e.target.value); setPagina(0); }}
            className="bg-transparent text-sm focus:outline-none">
            {MODULOS_AUDITORIA.map(m => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </div>
        <input
          type="text" placeholder="Buscar por usuario, accion o descripcion..."
          value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-[var(--clm)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]"
        />
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }} />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="flex justify-center mb-3 text-gray-300"><IcoShield /></div>
          <p className="text-sm">Sin registros de actividad aun.</p>
          <p className="text-xs mt-1">Las acciones del sistema apareceran aqui automaticamente.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--clm)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--cl)' }}>
                  {['Fecha y Hora', 'Usuario', 'Modulo', 'Accion', 'Descripcion'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--cd)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--clm)]">
                {filtradas.map(a => (
                  <tr key={a.id} className="hover:bg-[var(--cl)]/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFecha(a.creadoEn)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--cd)] text-xs">{a.nombreUsuario ?? '—'}</p>
                      {a.rolUsuario && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--cl)', color: 'var(--cp)' }}>
                          {a.rolUsuario}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg font-medium bg-[var(--cl)] text-[var(--cd)] capitalize">
                        {a.modulo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold capitalize ${colorAccion(a.accion)}`}>
                        {a.accion.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                      <p className="truncate" title={a.descripcion ?? ''}>{a.descripcion ?? '—'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--clm)' }}>
            <p className="text-xs text-gray-500">{filtradas.length} registros visibles</p>
            <div className="flex gap-2">
              <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--clm)] text-[var(--cd)] hover:bg-[var(--cl)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Anterior
              </button>
              <span className="px-3 py-1.5 text-xs text-gray-500">Pag. {pagina + 1}</span>
              <button disabled={acciones.length < POR_PAGINA} onClick={() => setPagina(p => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--clm)] text-[var(--cd)] hover:bg-[var(--cl)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL — TABS
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloAuditoria() {
  const [tab, setTab] = useState<'log' | 'sesiones'>('log');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--cl)', color: 'var(--cp)' }}>
            <IcoShield />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--cd)]">Seguridad y Auditoría</h1>
            <p className="text-sm text-gray-500">Acceso exclusivo CEO y TI.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--cl)' }}>
        {([
          { id: 'log',      label: 'Registro de Actividad', Ico: IcoShield  },
          { id: 'sesiones', label: 'Sesiones Activas',      Ico: IcoMonitor },
        ] as const).map(({ id, label, Ico }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              tab === id ? 'text-white shadow-sm' : 'text-gray-500 hover:text-[var(--cd)]'
            }`}
            style={tab === id ? { backgroundColor: 'var(--cp)' } : {}}>
            <Ico />{label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'log'      && <PanelAuditoria />}
      {tab === 'sesiones' && <PanelSesiones />}
    </div>
  );
}
