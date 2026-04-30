'use client';

/**
 * @fileoverview Módulo Directorio del Personal.
 * - Todos los roles: ven las tarjetas del equipo y pueden abrir el perfil.
 * - CEO / TI / Contable: pueden registrar y ver el historial de pagos de cada miembro.
 * - Personal_base: ve el directorio y su propio historial de pagos (solo lectura).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Search, Phone, Mail, Briefcase, RefreshCw,
  Loader2, AlertCircle, X, Plus, DollarSign, ChevronRight,
  CreditCard, Clock, FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import { obtenerUsuarios } from '@/lib/actions/usuarios-actions';
import { obtenerPagosDeUsuario, crearPagoPersonal } from '@/lib/actions/directorio-actions';
import { esContador, etiquetaRol, formatearMoneda, formatearFechaCorta } from '@/lib/utilidades';
import type { Usuario, RolUsuario, PagoPersonal, TipoPagoPersonal } from '@/lib/tipos';
import { ETIQUETA_TIPO_PAGO as ETIQUETAS_PAGO } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const ROL_COLORES: Record<RolUsuario, { bg: string; text: string }> = {
  CEO:           { bg: 'rgba(4,40,66,0.1)',    text: 'var(--cp)' },
  TI:            { bg: 'rgba(0,122,136,0.1)',  text: '#007A88' },
  Contable:      { bg: 'rgba(186,86,40,0.1)',  text: 'var(--cs)' },
  Personal_base: { bg: 'rgba(74,68,63,0.1)',   text: 'var(--cd)' },
  Proveedor:     { bg: 'rgba(100,80,60,0.1)',  text: '#64503C' },
};

const AVATAR_COLORES = [
  'rgba(4,40,66,0.85)',
  'rgba(186,86,40,0.85)',
  'rgba(0,122,136,0.85)',
  'rgba(74,68,63,0.85)',
];

const TIPOS_PAGO: TipoPagoPersonal[] = [
  'Nomina', 'Honorarios', 'Bonificacion', 'Anticipo', 'Liquidacion', 'Otro',
];

const HOY = new Date().toISOString().slice(0, 10);

const FORM_PAGO_INICIAL = {
  valorCop:          '',
  concepto:          '',
  numeroComprobante: '',
  tipoPago:          'Nomina' as TipoPagoPersonal,
  fechaPago:         HOY,
  horaPago:          '',
  periodo:           '',
  notas:             '',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const INICIALES = (nombre: string) =>
  nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: REGISTRAR PAGO
// ─────────────────────────────────────────────────────────────────────────────

interface ModalPagoProps {
  colaborador: Usuario;
  registradoPorId: string;
  onCerrar: () => void;
  onGuardado: (pago: PagoPersonal) => void;
}

function ModalPago({ colaborador, registradoPorId, onCerrar, onGuardado }: ModalPagoProps) {
  const [form, setForm] = useState(FORM_PAGO_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseInt(form.valorCop.replace(/\D/g, ''), 10);
    if (!valor || valor <= 0) { setError('El valor debe ser mayor a cero.'); return; }
    if (!form.concepto.trim())  { setError('El concepto es obligatorio.'); return; }

    setGuardando(true);
    setError('');
    try {
      const res = await crearPagoPersonal({
        usuarioId:          colaborador.id,
        valorCop:           valor,
        concepto:           form.concepto.trim(),
        numeroComprobante:  form.numeroComprobante.trim() || undefined,
        tipoPago:           form.tipoPago,
        fechaPago:          form.fechaPago,
        horaPago:           form.horaPago || undefined,
        periodo:            form.periodo.trim() || undefined,
        notas:              form.notas.trim() || undefined,
        registradoPorId,
      });
      if (res.ok && res.datos) {
        onGuardado(res.datos);
      } else {
        setError(res.error ?? 'Error al registrar el pago.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-y-auto"
        style={{ backgroundColor: 'white', maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>Registrar Pago</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Para: <span className="font-semibold" style={{ color: 'var(--cp)' }}>{colaborador.nombreCompleto}</span>
            </p>
          </div>
          <button onClick={onCerrar} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 p-3 rounded-lg flex items-center gap-2 text-sm"
            style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
            <AlertCircle size={14} />{error}
          </div>
        )}

        <form onSubmit={manejarEnvio} className="px-6 pb-6 space-y-4">
          {/* Valor + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                Valor (COP) *
              </label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.valorCop}
                  onChange={e => set('valorCop', e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="1500000"
                  required
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                Tipo de Pago *
              </label>
              <select
                value={form.tipoPago}
                onChange={e => set('tipoPago', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
              >
                {TIPOS_PAGO.map(t => (
                  <option key={t} value={t}>{ETIQUETAS_PAGO[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
              Concepto *
            </label>
            <input
              value={form.concepto}
              onChange={e => set('concepto', e.target.value)}
              placeholder="Ej: Nómina febrero 2025"
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={form.fechaPago}
                max={HOY}
                onChange={e => set('fechaPago', e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                Hora
              </label>
              <input
                type="time"
                value={form.horaPago}
                onChange={e => set('horaPago', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
            </div>
          </div>

          {/* Comprobante + Periodo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                N° Comprobante
              </label>
              <input
                value={form.numeroComprobante}
                onChange={e => set('numeroComprobante', e.target.value)}
                placeholder="COMP-001"
                className="w-full px-3 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                Periodo
              </label>
              <input
                value={form.periodo}
                onChange={e => set('periodo', e.target.value)}
                placeholder="Ej: Febrero 2025"
                className="w-full px-3 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
              Notas internas
            </label>
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full px-3 py-2.5 rounded-xl text-sm border resize-none"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: 'var(--cp)', color: 'white', opacity: guardando ? 0.6 : 1 }}
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {guardando ? 'Guardando...' : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL LATERAL: PERFIL + HISTORIAL DE PAGOS
// ─────────────────────────────────────────────────────────────────────────────

interface PanelPerfilProps {
  usuario: Usuario;
  avatarColor: string;
  puedeRegistrarPagos: boolean;
  registradoPorId: string;
  onCerrar: () => void;
}

function PanelPerfil({
  usuario, avatarColor, puedeRegistrarPagos, registradoPorId, onCerrar,
}: PanelPerfilProps) {
  const [pagos, setPagos] = useState<PagoPersonal[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(true);
  const [errorPagos, setErrorPagos] = useState('');
  const [modalPago, setModalPago] = useState(false);

  const cargarPagos = useCallback(async () => {
    setCargandoPagos(true);
    setErrorPagos('');
    try {
      const res = await obtenerPagosDeUsuario(usuario.id);
      if (res.ok && res.datos) {
        setPagos(res.datos);
      } else {
        setErrorPagos(res.error ?? 'No se pudo cargar el historial.');
      }
    } finally {
      setCargandoPagos(false);
    }
  }, [usuario.id]);

  useEffect(() => { cargarPagos(); }, [cargarPagos]);

  const totalPagado = useMemo(
    () => pagos.reduce((acc, p) => acc + p.valorCop, 0),
    [pagos],
  );

  const colores = ROL_COLORES[usuario.rol];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onCerrar}
      />

      {/* Panel deslizable desde la derecha */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col overflow-hidden"
        style={{
          width: 'min(480px, 100vw)',
          backgroundColor: 'white',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Cabecera del panel */}
        <div className="p-6 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {INICIALES(usuario.nombreCompleto)}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--cd)' }}>
                {usuario.nombreCompleto}
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold inline-block mt-1"
                style={{ backgroundColor: colores.bg, color: colores.text }}
              >
                {etiquetaRol(usuario.rol)}
              </span>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0 mt-0.5"
          >
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Datos de contacto */}
        <div className="px-6 py-4 flex-shrink-0 space-y-2.5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          {usuario.cargo && (
            <div className="flex items-center gap-3">
              <Briefcase size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--cd)' }}>{usuario.cargo}</span>
            </div>
          )}
          {usuario.correo && (
            <div className="flex items-center gap-3">
              <Mail size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <a href={`mailto:${usuario.correo}`}
                className="text-sm hover:underline truncate"
                style={{ color: 'var(--cp)' }}>
                {usuario.correo}
              </a>
            </div>
          )}
          {usuario.telefono && (
            <div className="flex items-center gap-3">
              <Phone size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <a href={`tel:${usuario.telefono}`}
                className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {usuario.telefono}
              </a>
            </div>
          )}
        </div>

        {/* Historial de pagos */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="px-6 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--cd)' }}>
                Historial de Pagos
              </h3>
              {pagos.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Total: <span className="font-semibold" style={{ color: 'var(--cp)' }}>
                    {formatearMoneda(totalPagado)}
                  </span>
                </p>
              )}
            </div>
            {puedeRegistrarPagos && (
              <button
                onClick={() => setModalPago(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--cp)', color: 'white' }}
              >
                <Plus size={12} />
                Registrar Pago
              </button>
            )}
          </div>

          {/* Cargando */}
          {cargandoPagos && (
            <div className="flex-1 flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--cp)' }} />
            </div>
          )}

          {/* Error */}
          {!cargandoPagos && errorPagos && (
            <div className="mx-6 p-3 rounded-xl flex items-center gap-2 text-sm"
              style={{ backgroundColor: 'rgba(186,86,40,0.08)', color: 'var(--cs)' }}>
              <AlertCircle size={14} />
              {errorPagos}
              <button onClick={cargarPagos} className="ml-auto underline text-xs">
                Reintentar
              </button>
            </div>
          )}

          {/* Lista vacía */}
          {!cargandoPagos && !errorPagos && pagos.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-12"
              style={{ color: 'var(--muted-foreground)' }}>
              <CreditCard size={32} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Sin pagos registrados</p>
              {puedeRegistrarPagos && (
                <p className="text-xs mt-1 opacity-70">
                  Usa el botón &quot;Registrar Pago&quot; para agregar el primero.
                </p>
              )}
            </div>
          )}

          {/* Tabla de pagos */}
          {!cargandoPagos && pagos.length > 0 && (
            <div className="px-6 pb-6 space-y-3">
              {pagos.map(pago => (
                <div
                  key={pago.id}
                  className="rounded-xl p-4 space-y-2"
                  style={{
                    backgroundColor: 'rgba(4,40,66,0.03)',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Fila superior: valor + tipo */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-base font-bold" style={{ color: 'var(--cp)' }}>
                      {formatearMoneda(pago.valorCop)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{ backgroundColor: 'rgba(4,40,66,0.08)', color: 'var(--cp)' }}
                    >
                      {ETIQUETAS_PAGO[pago.tipoPago]}
                    </span>
                  </div>

                  {/* Concepto */}
                  <p className="text-sm font-medium" style={{ color: 'var(--cd)' }}>
                    {pago.concepto}
                  </p>

                  {/* Metadatos */}
                  <div className="flex flex-wrap items-center gap-3 text-xs"
                    style={{ color: 'var(--muted-foreground)' }}>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatearFechaCorta(pago.fechaPago)}
                      {pago.horaPago && ` · ${pago.horaPago}`}
                    </span>
                    {pago.periodo && (
                      <span className="flex items-center gap-1">
                        <FileText size={11} />
                        {pago.periodo}
                      </span>
                    )}
                    {pago.numeroComprobante && (
                      <span className="font-mono">#{pago.numeroComprobante}</span>
                    )}
                  </div>

                  {/* Registrado por */}
                  {pago.registradoPor && (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Registrado por: <span className="font-medium">{pago.registradoPor}</span>
                    </p>
                  )}

                  {/* Notas */}
                  {pago.notas && (
                    <p className="text-xs italic border-t pt-2"
                      style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>
                      {pago.notas}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal registrar pago */}
      {modalPago && (
        <ModalPago
          colaborador={usuario}
          registradoPorId={registradoPorId}
          onCerrar={() => setModalPago(false)}
          onGuardado={nuevoPago => {
            setPagos(prev => [nuevoPago, ...prev]);
            setModalPago(false);
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloDirectorio() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<RolUsuario | 'Todos'>('Todos');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<{ u: Usuario; idx: number } | null>(null);

  const puedeRegistrarPagos = esContador(usuario?.rol ?? 'Personal_base');

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const res = await obtenerUsuarios();
      if (res.ok && res.datos) {
        setUsuarios(res.datos.filter(u => u.activo && u.rol !== 'Proveedor'));
      } else {
        setErrorCarga(res.error ?? 'No se pudo cargar el directorio.');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const usuariosFiltrados = useMemo(() => {
    let lista = filtroRol === 'Todos' ? usuarios : usuarios.filter(u => u.rol === filtroRol);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(u =>
        u.nombreCompleto.toLowerCase().includes(q) ||
        u.cargo.toLowerCase().includes(q) ||
        u.correo.toLowerCase().includes(q),
      );
    }
    return lista;
  }, [usuarios, busqueda, filtroRol]);

  const rolesPresentes = useMemo(
    () => Array.from(new Set(usuarios.map(u => u.rol))),
    [usuarios],
  );

  if (cargando) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--cp)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Cargando directorio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>
            Directorio del Equipo
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {usuarios.length} miembro{usuarios.length !== 1 ? 's' : ''} activo
            {usuarios.length !== 1 ? 's' : ''} · Haz clic en una tarjeta para ver el perfil
            {puedeRegistrarPagos ? ' y registrar pagos' : ''}
          </p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'white' }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Error */}
      {errorCarga && (
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{ backgroundColor: 'rgba(186,86,40,0.08)', border: '1px solid rgba(186,86,40,0.2)' }}>
          <AlertCircle size={16} style={{ color: 'var(--cs)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--cs)' }}>{errorCarga}</p>
          <button onClick={cargar} className="ml-auto text-xs underline" style={{ color: 'var(--cs)' }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Buscador + Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cargo o correo..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['Todos', ...rolesPresentes] as (RolUsuario | 'Todos')[]).map(rol => (
            <button
              key={rol}
              onClick={() => setFiltroRol(rol)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: filtroRol === rol ? 'var(--cp)' : 'white',
                color: filtroRol === rol ? 'white' : 'var(--muted-foreground)',
                border: `1px solid ${filtroRol === rol ? 'var(--cp)' : 'var(--border)'}`,
              }}
            >
              {rol === 'Todos' ? 'Todos' : etiquetaRol(rol)}
            </button>
          ))}
        </div>
      </div>

      {/* Cuadrícula de tarjetas */}
      {usuariosFiltrados.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No se encontraron miembros con esos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {usuariosFiltrados.map((u, idx) => {
            const colores = ROL_COLORES[u.rol];
            const avatarColor = AVATAR_COLORES[idx % AVATAR_COLORES.length];
            const seleccionado = usuarioSeleccionado?.u.id === u.id;

            return (
              <button
                key={u.id}
                onClick={() => setUsuarioSeleccionado(seleccionado ? null : { u, idx })}
                className="rounded-2xl p-5 flex flex-col gap-4 text-left transition-all hover:shadow-md focus:outline-none"
                style={{
                  backgroundColor: 'white',
                  border: seleccionado
                    ? '2px solid var(--cp)'
                    : '1px solid rgba(0,0,0,0.06)',
                  boxShadow: seleccionado
                    ? '0 0 0 3px rgba(4,40,66,0.08)'
                    : '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                {/* Avatar + nombre */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {INICIALES(u.nombreCompleto)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--cd)' }}>
                      {u.nombreCompleto}
                    </p>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium inline-block mt-0.5"
                      style={{ backgroundColor: colores.bg, color: colores.text }}
                    >
                      {etiquetaRol(u.rol)}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                </div>

                {/* Datos de contacto */}
                <div className="space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                  {u.cargo && (
                    <div className="flex items-center gap-2">
                      <Briefcase size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {u.cargo}
                      </span>
                    </div>
                  )}
                  {u.correo && (
                    <div className="flex items-center gap-2">
                      <Mail size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      <span className="text-xs truncate" style={{ color: 'var(--cp)' }}>
                        {u.correo}
                      </span>
                    </div>
                  )}
                  {u.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {u.telefono}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Panel lateral de perfil */}
      {usuarioSeleccionado && (
        <PanelPerfil
          usuario={usuarioSeleccionado.u}
          avatarColor={AVATAR_COLORES[usuarioSeleccionado.idx % AVATAR_COLORES.length]}
          puedeRegistrarPagos={puedeRegistrarPagos}
          registradoPorId={usuario?.id ?? ''}
          onCerrar={() => setUsuarioSeleccionado(null)}
        />
      )}
    </div>
  );
}
