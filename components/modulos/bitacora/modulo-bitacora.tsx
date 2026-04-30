'use client';

/**
 * @fileoverview Módulo Bitácora Estratégica — Escala ADN.
 *
 * Roles:
 *  - Personal_base / TI / Contable → formulario de registro + historial propio.
 *  - CEO → tabla maestra de todos los usuarios con filtros + sistema de feedback.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, Save, Calendar, Clock, TrendingUp,
  MessageSquare, Bell, ChevronDown, ChevronUp, Search, X,
  CheckCircle, Filter,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import {
  obtenerMisRegistros,
  obtenerTodosLosRegistros,
  guardarRegistroBitacora,
  guardarComentarioCeo,
  marcarComentarioLeido,
  obtenerUsuariosParaBitacora,
} from '@/lib/actions/bitacora-actions';
import type {
  RegistroBitacora, ActividadBitacora, EstadoAnimico,
} from '@/lib/tipos';
import { EMOJI_ANIMICO } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const ESTADOS_ANIMICOS: EstadoAnimico[] = ['Feliz', 'Productivo', 'Estresado', 'Agotado'];

const COLOR_ANIMICO: Record<EstadoAnimico, { bg: string; text: string }> = {
  Feliz:      { bg: '#d1fae5', text: '#065f46' },
  Productivo: { bg: '#dbeafe', text: '#1e40af' },
  Estresado:  { bg: '#fef3c7', text: '#92400e' },
  Agotado:    { bg: '#fee2e2', text: '#991b1b' },
};

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatearFechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES ATOMICOS LOCALES
// ─────────────────────────────────────────────────────────────────────────────

function BadgeAnimico({ estado }: { estado: EstadoAnimico }) {
  const c = COLOR_ANIMICO[estado];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {EMOJI_ANIMICO[estado]} {estado}
    </span>
  );
}

function BarraAvance({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

function Spinner({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm text-gray-500">{texto}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIO DE REGISTRO (Personal_base, TI, Contable)
// ─────────────────────────────────────────────────────────────────────────────

interface FilaActividad {
  key: string;
  descripcion: string;
  horas: string;
}

function FormularioBitacora({
  onGuardado,
  registroExistente,
}: {
  onGuardado: (r: RegistroBitacora) => void;
  registroExistente?: RegistroBitacora | null;
}) {
  const { usuario } = useAuth();
  const [fecha, setFecha]             = useState(hoy());
  const [filas, setFilas]             = useState<FilaActividad[]>([{ key: crypto.randomUUID(), descripcion: '', horas: '' }]);
  const [pct, setPct]                 = useState<string>('0');
  const [animico, setAnimico]         = useState<EstadoAnimico>('Productivo');
  const [guardando, setGuardando]     = useState(false);
  const [error, setError]             = useState('');
  const [exito, setExito]             = useState(false);

  // Precargar si hay registro existente para esa fecha
  useEffect(() => {
    if (registroExistente) {
      setFecha(registroExistente.fecha);
      setFilas(
        registroExistente.actividades.length > 0
          ? registroExistente.actividades.map((a) => ({
              key: crypto.randomUUID(),
              descripcion: a.descripcion,
              horas: String(a.horas),
            }))
          : [{ key: crypto.randomUUID(), descripcion: '', horas: '' }],
      );
      setPct(String(registroExistente.porcentajeAvance));
      setAnimico(registroExistente.estadoAnimico);
    }
  }, [registroExistente]);

  const totalHoras = useMemo(
    () => filas.reduce((s, f) => s + (parseFloat(f.horas) || 0), 0),
    [filas],
  );

  const agregarFila = () => setFilas((prev) => [...prev, { key: crypto.randomUUID(), descripcion: '', horas: '' }]);

  const eliminarFila = (key: string) => {
    if (filas.length === 1) return; // mínimo 1
    setFilas((prev) => prev.filter((f) => f.key !== key));
  };

  const actualizarFila = (key: string, campo: 'descripcion' | 'horas', valor: string) => {
    setFilas((prev) => prev.map((f) => f.key === key ? { ...f, [campo]: valor } : f));
  };

  const guardar = async () => {
    if (!usuario) return;
    setError('');
    const filasValidas = filas.filter((f) => f.descripcion.trim() && parseFloat(f.horas) > 0);
    if (filasValidas.length === 0) { setError('Agrega al menos una actividad con descripción y horas válidas.'); return; }
    const pctNum = parseInt(pct, 10);
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 100) { setError('El porcentaje debe estar entre 0 y 100.'); return; }

    setGuardando(true);
    try {
      const res = await guardarRegistroBitacora({
        usuarioId:        usuario.id,
        fecha,
        actividades:      filasValidas.map((f) => ({ descripcion: f.descripcion.trim(), horas: parseFloat(f.horas) })),
        porcentajeAvance: pctNum,
        estadoAnimico:    animico,
      });
      if (!res.ok || !res.datos) { setError(res.error ?? 'Error al guardar.'); return; }
      setExito(true);
      setTimeout(() => setExito(false), 3000);
      onGuardado(res.datos);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[var(--clm)] shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--cl)' }}>
          <Calendar size={20} style={{ color: 'var(--cp)' }} />
        </div>
        <div>
          <h2 className="font-bold text-[var(--cd)]">Nuevo Registro</h2>
          <p className="text-xs text-gray-500">Documenta tus actividades del día</p>
        </div>
      </div>

      {/* Fecha */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--cd)] uppercase tracking-wide">
          Fecha <span style={{ color: 'var(--cs)' }}>*</span>
        </label>
        <input
          type="date"
          value={fecha}
          max={hoy()}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] bg-white text-[var(--cd)]"
        />
      </div>

      {/* Actividades */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--cd)] uppercase tracking-wide">
            Actividades del Día <span style={{ color: 'var(--cs)' }}>*</span>
          </label>
          <button
            type="button"
            onClick={agregarFila}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            <Plus size={13} /> Añadir Actividad
          </button>
        </div>

        {/* Cabecera */}
        <div className="hidden sm:grid grid-cols-[1fr_120px_36px] gap-2 px-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Descripción</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center">Horas</span>
          <span />
        </div>

        {filas.map((fila, idx) => (
          <div key={fila.key} className="grid grid-cols-[1fr_120px_36px] gap-2 items-start">
            <input
              type="text"
              value={fila.descripcion}
              placeholder={`Actividad ${idx + 1}`}
              onChange={(e) => actualizarFila(fila.key, 'descripcion', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] placeholder-gray-400"
            />
            <input
              type="number"
              value={fila.horas}
              placeholder="0.5"
              min="0.5"
              max="24"
              step="0.5"
              onChange={(e) => actualizarFila(fila.key, 'horas', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] text-center tabular-nums"
            />
            <button
              type="button"
              onClick={() => eliminarFila(fila.key)}
              disabled={filas.length === 1}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        {/* Total de horas */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Clock size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">Total:</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--cp)' }}>
            {totalHoras.toFixed(1)} h
          </span>
        </div>
      </div>

      {/* Métricas de cierre */}
      <div className="grid sm:grid-cols-2 gap-5">
        {/* Porcentaje de avance */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--cd)] uppercase tracking-wide">
            <TrendingUp size={12} className="inline mr-1" />
            Porcentaje de Avance General
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0} max={100} step={5}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="flex-1 accent-[var(--cp)]"
            />
            <input
              type="number"
              min={0} max={100}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="w-16 px-2 py-1.5 text-sm text-center rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] tabular-nums font-bold"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <BarraAvance pct={parseInt(pct, 10) || 0} />
        </div>

        {/* Estado anímico */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--cd)] uppercase tracking-wide">
            Estado Anímico
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ESTADOS_ANIMICOS.map((estado) => {
              const c = COLOR_ANIMICO[estado];
              const activo = animico === estado;
              return (
                <button
                  key={estado}
                  type="button"
                  onClick={() => setAnimico(estado)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all"
                  style={{
                    borderColor: activo ? c.text : 'var(--clm)',
                    backgroundColor: activo ? c.bg : 'white',
                    color: activo ? c.text : 'var(--cd)',
                  }}
                >
                  <span className="text-base">{EMOJI_ANIMICO[estado]}</span>
                  {estado}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
          <X size={15} /> {error}
        </div>
      )}
      {exito && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
          <CheckCircle size={15} /> Registro guardado exitosamente.
        </div>
      )}

      {/* Guardar */}
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60"
        style={{ backgroundColor: 'var(--cp)' }}
      >
        {guardando
          ? <><span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" />Guardando...</>
          : <><Save size={15} />Guardar Registro</>
        }
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILA EXPANDIBLE DEL HISTORIAL (Personal / TI / Contable)
// ─────────────────────────────────────────────────────────────────────────────

function FilaHistorial({
  registro,
  onMarcarLeido,
}: {
  registro: RegistroBitacora;
  onMarcarLeido: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const tieneNotif = !!registro.comentarioCeo && !registro.comentarioLeido;

  const handleAbrir = () => {
    setAbierto((v) => !v);
    if (!abierto && tieneNotif) onMarcarLeido(registro.id);
  };

  return (
    <div
      className={`bg-white rounded-xl border transition-all ${tieneNotif ? 'border-[var(--cp)] shadow-md' : 'border-[var(--clm)]'}`}
    >
      <button
        type="button"
        onClick={handleAbrir}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
      >
        {/* Notificación */}
        {tieneNotif && (
          <span className="relative flex shrink-0">
            <Bell size={16} style={{ color: 'var(--cp)' }} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          </span>
        )}

        {/* Fecha */}
        <span className="font-mono text-sm font-bold text-[var(--cd)] shrink-0">
          {formatearFechaCorta(registro.fecha)}
        </span>

        <BadgeAnimico estado={registro.estadoAnimico} />

        <div className="flex-1 min-w-0">
          <BarraAvance pct={registro.porcentajeAvance} />
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <Clock size={12} />
          {(registro.totalHoras ?? 0).toFixed(1)} h
        </div>

        {abierto ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {abierto && (
        <div className="px-5 pb-5 space-y-4 border-t border-[var(--clm)]">
          {/* Actividades */}
          <div className="pt-4">
            <p className="text-xs font-bold text-[var(--cd)] uppercase tracking-wide mb-2">Actividades</p>
            <div className="space-y-1.5">
              {registro.actividades.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-gray-700 flex-1">{a.descripcion}</span>
                  <span className="font-semibold tabular-nums shrink-0" style={{ color: 'var(--cp)' }}>{a.horas} h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comentario CEO */}
          {registro.comentarioCeo && (
            <div
              className="p-4 rounded-xl space-y-1"
              style={{ backgroundColor: 'var(--cl)', border: '1px solid var(--clm)' }}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} style={{ color: 'var(--cp)' }} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--cp)' }}>Feedback del CEO</span>
              </div>
              <p className="text-sm text-[var(--cd)]">{registro.comentarioCeo}</p>
              {registro.comentadoEn && (
                <p className="text-[10px] text-gray-400">
                  {new Date(registro.comentadoEn).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA USUARIO (Personal_base / TI / Contable)
// ─────────────────────────────────────────────────────────────────────────────

function VistaUsuario() {
  const { usuario } = useAuth();
  const [registros, setRegistros]     = useState<RegistroBitacora[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState('');
  const [registroHoy, setRegistroHoy] = useState<RegistroBitacora | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    const res = await obtenerMisRegistros(usuario.id);
    if (res.ok && res.datos) {
      setRegistros(res.datos);
      const hoyStr = hoy();
      setRegistroHoy(res.datos.find((r) => r.fecha === hoyStr) ?? null);
    } else {
      setError(res.error ?? 'Error al cargar registros.');
    }
    setCargando(false);
  }, [usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardado = useCallback((r: RegistroBitacora) => {
    setRegistros((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = r; return n; }
      return [r, ...prev];
    });
    if (r.fecha === hoy()) setRegistroHoy(r);
  }, []);

  const handleMarcarLeido = useCallback(async (id: string) => {
    await marcarComentarioLeido(id);
    setRegistros((prev) =>
      prev.map((r) => r.id === id ? { ...r, comentarioLeido: true } : r),
    );
  }, []);

  const notifPendientes = registros.filter((r) => r.comentarioCeo && !r.comentarioLeido).length;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--cd)]">Bitácora Estratégica</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registra tus actividades y avance diario</p>
        </div>
        {notifPendientes > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <Bell size={15} className="text-red-500" />
            <span className="text-xs font-semibold text-red-700">{notifPendientes} feedback{notifPendientes > 1 ? 's' : ''} nuevo{notifPendientes > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Formulario */}
      <FormularioBitacora onGuardado={handleGuardado} registroExistente={registroHoy} />

      {/* Historial */}
      <div className="space-y-3">
        <h2 className="font-bold text-[var(--cd)] text-sm uppercase tracking-wide">
          Mi Historial ({registros.length} registros)
        </h2>

        {cargando ? (
          <Spinner texto="Cargando historial..." />
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        ) : registros.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aún no tienes registros. ¡Crea el primero!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {registros.map((r) => (
              <FilaHistorial key={r.id} registro={r} onMarcarLeido={handleMarcarLeido} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILA CEO: tabla maestra con feedback inline
// ─────────────────────────────────────────────────────────────────────────────

function FilaCeo({ registro, onComentarioGuardado }: {
  registro: RegistroBitacora;
  onComentarioGuardado: (id: string, texto: string) => void;
}) {
  const [abierto, setAbierto]         = useState(false);
  const [comentario, setComentario]   = useState(registro.comentarioCeo ?? '');
  const [guardandoCom, setGuardandoCom] = useState(false);
  const [okCom, setOkCom]             = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const guardarCom = async () => {
    if (!comentario.trim()) return;
    setGuardandoCom(true);
    const res = await guardarComentarioCeo(registro.id, comentario.trim());
    if (res.ok) {
      setOkCom(true);
      onComentarioGuardado(registro.id, comentario.trim());
      setTimeout(() => setOkCom(false), 2000);
    }
    setGuardandoCom(false);
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--clm)] overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full grid grid-cols-[140px_1fr_110px_100px_90px_32px] gap-3 items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors text-sm"
      >
        <span className="font-mono text-xs text-gray-500">{formatearFechaCorta(registro.fecha)}</span>
        <span className="font-medium text-[var(--cd)] truncate">{registro.nombreUsuario}</span>
        <BadgeAnimico estado={registro.estadoAnimico} />
        <BarraAvance pct={registro.porcentajeAvance} />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock size={11} />
          {(registro.totalHoras ?? 0).toFixed(1)} h
        </div>
        <div className="flex items-center gap-1">
          {registro.comentarioCeo && (
            <MessageSquare size={13} style={{ color: registro.comentarioLeido ? '#9ca3af' : 'var(--cp)' }} />
          )}
          {abierto ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--clm)] pt-4">
          {/* Actividades */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Actividades registradas</p>
            <div className="space-y-1">
              {registro.actividades.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-gray-600 flex-1">{a.descripcion}</span>
                  <span className="font-semibold tabular-nums shrink-0 text-gray-700">{a.horas} h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Campo de feedback CEO */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--cd)] uppercase tracking-wide flex items-center gap-1.5">
              <MessageSquare size={12} /> Comentario / Feedback
            </label>
            <textarea
              ref={textareaRef}
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe tu feedback para este colaborador..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={guardarCom}
                disabled={guardandoCom || !comentario.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--cp)' }}
              >
                {guardandoCom
                  ? <><span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" />Guardando...</>
                  : okCom
                    ? <><CheckCircle size={12} />Guardado</>
                    : <><Save size={12} />Enviar Feedback</>
                }
              </button>
              {registro.comentarioLeido && registro.comentarioCeo && (
                <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle size={11} /> Visto por el usuario
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA CEO — Tabla maestra con filtros
// ─────────────────────────────────────────────────────────────────────────────

function VistaCeo() {
  const [registros, setRegistros]         = useState<RegistroBitacora[]>([]);
  const [usuarios, setUsuarios]           = useState<{ id: string; nombreCompleto: string }[]>([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState('');
  const [filtroUsuarioId, setFiltroUserId] = useState('');
  const [filtroNombre, setFiltroNombre]   = useState('');
  const [desde, setDesde]                 = useState('');
  const [hasta, setHasta]                 = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    const [resReg, resUsr] = await Promise.all([
      obtenerTodosLosRegistros(filtroUsuarioId || undefined, desde || undefined, hasta || undefined),
      obtenerUsuariosParaBitacora(),
    ]);
    if (resReg.ok && resReg.datos) setRegistros(resReg.datos);
    else setError(resReg.error ?? 'Error al cargar.');
    if (resUsr.ok && resUsr.datos) setUsuarios(resUsr.datos);
    setCargando(false);
  }, [filtroUsuarioId, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const registrosFiltrados = useMemo(() => {
    if (!filtroNombre) return registros;
    const q = filtroNombre.toLowerCase();
    return registros.filter((r) => r.nombreUsuario?.toLowerCase().includes(q));
  }, [registros, filtroNombre]);

  const handleComentarioGuardado = useCallback((id: string, texto: string) => {
    setRegistros((prev) =>
      prev.map((r) => r.id === id ? { ...r, comentarioCeo: texto, comentarioLeido: false } : r),
    );
  }, []);

  const limpiarFiltros = () => {
    setFiltroUserId(''); setFiltroNombre(''); setDesde(''); setHasta('');
  };

  const hayFiltros = filtroUsuarioId || filtroNombre || desde || hasta;

  // Métricas rápidas
  const metricas = useMemo(() => ({
    totalRegistros: registrosFiltrados.length,
    promedioAvance: registrosFiltrados.length
      ? Math.round(registrosFiltrados.reduce((s, r) => s + r.porcentajeAvance, 0) / registrosFiltrados.length)
      : 0,
    totalHoras: registrosFiltrados.reduce((s, r) => s + (r.totalHoras ?? 0), 0),
    pendientesFeedback: registrosFiltrados.filter((r) => !r.comentarioCeo).length,
  }), [registrosFiltrados]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--cd)]">Bitácora Estratégica</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vista maestra — registros de todo el equipo</p>
      </div>

      {/* Tarjetas métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { titulo: 'Registros',      valor: metricas.totalRegistros,     color: 'var(--cp)',  icono: <Calendar size={16} /> },
          { titulo: 'Avance Promedio', valor: `${metricas.promedioAvance}%`, color: '#059669',  icono: <TrendingUp size={16} /> },
          { titulo: 'Horas Totales',  valor: `${metricas.totalHoras.toFixed(1)} h`, color: '#7c3aed', icono: <Clock size={16} /> },
          { titulo: 'Sin Feedback',   valor: metricas.pendientesFeedback, color: '#dc2626',   icono: <MessageSquare size={16} /> },
        ].map((m) => (
          <div key={m.titulo} className="bg-white rounded-xl p-4 border border-[var(--clm)] shadow-sm">
            <div className="flex items-center gap-2 mb-1" style={{ color: m.color }}>
              {m.icono}
              <span className="text-xs font-medium text-gray-500">{m.titulo}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: m.color }}>{m.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-[var(--clm)] p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={15} style={{ color: 'var(--cp)' }} />
          <span className="text-xs font-bold text-[var(--cd)] uppercase tracking-wide">Filtros</span>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="ml-auto text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <X size={12} /> Limpiar
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Buscar por nombre */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)]"
            />
          </div>

          {/* Selector de usuario */}
          <select
            value={filtroUsuarioId}
            onChange={(e) => setFiltroUserId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] bg-white text-[var(--cd)]"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombreCompleto}</option>
            ))}
          </select>

          {/* Fecha desde */}
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] text-[var(--cd)]"
            placeholder="Desde"
          />

          {/* Fecha hasta */}
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--clm)] focus:outline-none focus:ring-2 focus:ring-[var(--cp)] text-[var(--cd)]"
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Tabla */}
      {cargando ? (
        <Spinner texto="Cargando registros del equipo..." />
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-[var(--clm)]">
          <Calendar size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay registros con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Cabecera de columnas solo en desktop */}
          <div className="hidden lg:grid grid-cols-[140px_1fr_110px_100px_90px_32px] gap-3 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            <span>Fecha</span>
            <span>Colaborador</span>
            <span>Ánimo</span>
            <span>Avance</span>
            <span>Horas</span>
            <span />
          </div>

          {registrosFiltrados.map((r) => (
            <FilaCeo
              key={r.id}
              registro={r}
              onComentarioGuardado={handleComentarioGuardado}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT — Enrutador por rol
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloBitacora() {
  const { usuario } = useAuth();

  if (!usuario) return null;

  if (usuario.rol === 'CEO') return <VistaCeo />;

  // Personal_base, TI, Contable
  return <VistaUsuario />;
}
