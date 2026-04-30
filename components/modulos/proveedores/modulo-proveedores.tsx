/**
 * @fileoverview Módulo de Gestión y Registro de Proveedores.
 * Completamente dinámico: lee y escribe en las tablas `proveedores` y
 * `transacciones_proveedores` de PostgreSQL mediante Server Actions.
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Building2, Search, Plus, X, Check, ChevronDown,
  ChevronUp, DollarSign, Eye, RefreshCw, Loader2, AlertCircle, Pencil, Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import {
  obtenerProveedores, crearProveedor, actualizarProveedor,
  obtenerTransacciones, crearTransaccion, eliminarProveedor,
} from '@/lib/actions/proveedores-actions';
import { esContador, formatearMoneda, formatearFechaCorta } from '@/lib/utilidades';
import type { Proveedor, TransaccionProveedor, RegimenTributario } from '@/lib/tipos';

const REGIMENES: RegimenTributario[] = [
  'Responsable de IVA', 'No Responsable de IVA', 'Gran Contribuyente', 'Régimen Simple',
];

// ─────────────────────────────────────────────────────────────────────────────
// MODAL REGISTRO / EDICIÓN DE PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────

interface ModalProveedorProps {
  proveedorEditar?: Proveedor;
  registradoPorId: string;
  onCerrar: () => void;
  onGuardado: () => void;
}

function ModalProveedor({ proveedorEditar, registradoPorId, onCerrar, onGuardado }: ModalProveedorProps) {
  const esEdicion = !!proveedorEditar;
  const [form, setForm] = useState({
    razonSocial:              proveedorEditar?.razonSocial ?? '',
    nitCedula:                proveedorEditar?.nitCedula ?? '',
    direccion:                proveedorEditar?.direccion ?? '',
    ciudad:                   proveedorEditar?.ciudad ?? '',
    telefono:                 proveedorEditar?.telefono ?? '',
    correo:                   proveedorEditar?.correo ?? '',
    regimen:                  (proveedorEditar?.regimen ?? 'No Responsable de IVA') as RegimenTributario,
    responsabilidadesFiscales: proveedorEditar?.responsabilidadesFiscales ?? '',
    servicios:                proveedorEditar?.servicios ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');

  const actualizar = (c: string, v: string) => setForm(p => ({ ...p, [c]: v }));

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razonSocial || !form.nitCedula) return;
    setGuardando(true);
    setErrorServidor('');
    try {
      let resultado;
      if (esEdicion) {
        resultado = await actualizarProveedor(proveedorEditar.id, {
          ...form,
          registradoPorId,
        });
      } else {
        resultado = await crearProveedor({ ...form, registradoPorId });
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

  const camposBasicos = [
    { id: 'razonSocial',  label: 'Razón Social / Nombre *', placeholder: 'Empresa o persona natural', col: 2 },
    { id: 'nitCedula',    label: 'NIT / Cédula *',           placeholder: '800.123.456-7',             col: 1 },
    { id: 'telefono',     label: 'Teléfono',                 placeholder: '6011234567',                col: 1 },
    { id: 'correo',       label: 'Correo electrónico',       placeholder: 'contacto@empresa.com',       col: 1 },
    { id: 'ciudad',       label: 'Ciudad',                   placeholder: 'Medellín',                  col: 1 },
    { id: 'direccion',    label: 'Dirección',                placeholder: 'Cra 45 # 22-10',            col: 2 },
  ];

  return (
    <div className="modal-fondo" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="w-full max-w-2xl mx-4 rounded-2xl p-6 animar-entrada overflow-y-auto"
        style={{ backgroundColor: 'white', maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>
              {esEdicion ? 'Editar Proveedor' : 'Registrar Proveedor'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Complete los datos del tercero</p>
          </div>
          <button onClick={onCerrar}><X size={18} style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>

        {errorServidor && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
            style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
            <AlertCircle size={15} />{errorServidor}
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--cp)' }}>Datos Básicos</p>
            <div className="grid grid-cols-2 gap-3">
              {camposBasicos.map(campo => (
                <div key={campo.id} className={campo.col === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>{campo.label}</label>
                  <input
                    value={(form as Record<string, string>)[campo.id]}
                    onChange={e => actualizar(campo.id, e.target.value)}
                    placeholder={campo.placeholder}
                    required={campo.label.includes('*')}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--cp)' }}>Datos Tributarios</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Régimen</label>
                <select value={form.regimen} onChange={e => actualizar('regimen', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}>
                  {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Responsabilidades fiscales</label>
                <input value={form.responsabilidadesFiscales} onChange={e => actualizar('responsabilidadesFiscales', e.target.value)}
                  placeholder="IVA, Retención en la fuente..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Servicios que ofrece a Escala</label>
                <textarea value={form.servicios} onChange={e => actualizar('servicios', e.target.value)}
                  rows={2} placeholder="Describe los servicios o productos que provee..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm border resize-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--cp)', color: 'white', opacity: guardando ? 0.7 : 1 }}>
              {guardando
                ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                : <><Check size={15} /> {esEdicion ? 'Actualizar' : 'Registrar Proveedor'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL NUEVO PAGO
// ─────────────────────────────────────────────────────────────────────────────

interface ModalNuevoPagoProps {
  proveedorId: string;
  registradoPorId: string;
  onCerrar: () => void;
  onGuardado: () => void;
}

function ModalNuevoPago({ proveedorId, registradoPorId, onCerrar, onGuardado }: ModalNuevoPagoProps) {
  const [form, setForm] = useState({
    fecha:             new Date().toISOString().slice(0, 10),
    hora:              new Date().toTimeString().slice(0, 5),
    valor:             '',
    concepto:          '',
    numeroComprobante: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valor || !form.concepto) return;
    setGuardando(true);
    setError('');
    try {
      const resultado = await crearTransaccion({
        proveedorId,
        valor:             parseFloat(form.valor.replace(/\./g, '')),
        concepto:          form.concepto,
        numeroComprobante: form.numeroComprobante || undefined,
        fecha:             form.fecha,
        hora:              form.hora,
        registradoPorId,
      });
      if (resultado.ok) {
        onGuardado();
      } else {
        setError(resultado.error ?? 'Error al guardar');
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-fondo" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="w-full max-w-md mx-4 rounded-2xl p-6 animar-entrada"
        style={{ backgroundColor: 'white', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>Registrar Pago</h2>
          <button onClick={onCerrar}><X size={18} style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
            style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
            <AlertCircle size={15} />{error}
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Fecha *</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Hora</label>
              <input type="time" value={form.hora}
                onChange={e => setForm(p => ({ ...p, hora: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Valor (COP) *</label>
            <input value={form.valor}
              onChange={e => setForm(p => ({ ...p, valor: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder="Ej: 2500000" required
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Concepto *</label>
            <input value={form.concepto}
              onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
              placeholder="Ej: Flete transporte materiales" required
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>N° Comprobante</label>
            <input value={form.numeroComprobante}
              onChange={e => setForm(p => ({ ...p, numeroComprobante: e.target.value }))}
              placeholder="COMP-2025-0001"
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--cp)', color: 'white', opacity: guardando ? 0.7 : 1 }}>
              {guardando
                ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                : <><DollarSign size={14} /> Guardar Pago</>}
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

export default function ModuloProveedores() {
  const { usuario } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [transacciones, setTransacciones] = useState<TransaccionProveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoTrx, setCargandoTrx] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);
  const [mostrarFormProv, setMostrarFormProv] = useState(false);
  const [proveedorEditar, setProveedorEditar] = useState<Proveedor | undefined>();
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<Proveedor | null>(null);

  // Todos los hooks ANTES de cualquier return condicional (reglas de hooks)
  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const resultado = await obtenerProveedores();
      if (resultado.ok && resultado.datos) {
        setProveedores(resultado.datos);
      } else {
        setErrorCarga(resultado.error ?? 'Error al cargar proveedores.');
      }
    } catch {
      setErrorCarga('Error de conexión con la base de datos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarProveedores(); }, [cargarProveedores]);

  const cargarTransacciones = useCallback(async (proveedorId: string) => {
    setCargandoTrx(true);
    try {
      const resultado = await obtenerTransacciones(proveedorId);
      if (resultado.ok && resultado.datos) setTransacciones(resultado.datos);
    } finally {
      setCargandoTrx(false);
    }
  }, []);

  const seleccionarProveedor = useCallback((p: Proveedor) => {
    if (proveedorSeleccionado?.id === p.id) {
      setProveedorSeleccionado(null);
      setTransacciones([]);
    } else {
      setProveedorSeleccionado(p);
      cargarTransacciones(p.id);
    }
  }, [proveedorSeleccionado, cargarTransacciones]);

  const handleGuardadoProveedor = useCallback(() => {
    setMostrarFormProv(false);
    setProveedorEditar(undefined);
    cargarProveedores();
  }, [cargarProveedores]);

  const handleGuardadoPago = useCallback(() => {
    setMostrarFormPago(false);
    if (proveedorSeleccionado) cargarTransacciones(proveedorSeleccionado.id);
  }, [proveedorSeleccionado, cargarTransacciones]);

  const proveedoresFiltrados = useMemo(() =>
    proveedores.filter(p =>
      p.razonSocial.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.nitCedula.includes(busqueda)
    ),
    [proveedores, busqueda]
  );

  const handleEliminarProveedor = useCallback(async (p: Proveedor) => {
    setEliminandoId(p.id);
    setConfirmEliminar(null);
    try {
      const res = await eliminarProveedor(p.id);
      if (res.ok) {
        if (proveedorSeleccionado?.id === p.id) {
          setProveedorSeleccionado(null);
          setTransacciones([]);
        }
        cargarProveedores();
      } else {
        setErrorCarga(res.error ?? 'No se pudo eliminar el proveedor.');
      }
    } finally {
      setEliminandoId(null);
    }
  }, [proveedorSeleccionado, cargarProveedores]);

  const totalPagadoProveedor = useMemo(() =>
    transacciones.reduce((acc, t) => acc + t.valor, 0),
    [transacciones]
  );

  if (!usuario || !esContador(usuario.rol)) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center">
          <Building2 size={40} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="font-semibold" style={{ color: 'var(--cd)' }}>Acceso Restringido</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Solo roles CEO, TI y Contable tienen acceso a este módulo.
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>Gestión de Proveedores</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {proveedores.filter(p => p.activo).length} proveedores activos registrados
          </p>
        </div>
        <button onClick={() => { setProveedorEditar(undefined); setMostrarFormProv(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: 'var(--cp)', color: 'white', boxShadow: '0 4px 12px rgba(0,122,136,0.25)' }}>
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      {/* Buscador + Recargar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o NIT..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }} />
        </div>
        <button onClick={cargarProveedores} disabled={cargando}
          className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'white' }}>
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} style={{ color: 'var(--muted-foreground)' }} />
        </button>
      </div>

      {/* Estado de carga */}
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
            <button onClick={cargarProveedores} className="text-xs underline mt-0.5" style={{ color: 'var(--cs)' }}>
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tabla de proveedores */}
          <div className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'rgba(4,40,66,0.04)', borderBottom: '1px solid var(--border)' }}>
                  {['Proveedor', 'NIT / Cédula', 'Ciudad', 'Régimen', 'Servicios', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide"
                      style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map(p => (
                  <tr key={p.id} style={{
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                    backgroundColor: proveedorSeleccionado?.id === p.id ? 'rgba(0,122,136,0.04)' : 'transparent',
                  }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
                          {p.razonSocial[0]}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--cd)' }}>{p.razonSocial}</p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{p.correo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{p.nitCedula}</td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>{p.ciudad || '—'}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(0,122,136,0.08)', color: 'var(--cp)' }}>
                        {p.regimen}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)', maxWidth: '200px' }}>{p.servicios || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setProveedorEditar(p); setMostrarFormProv(true); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar proveedor">
                          <Pencil size={13} style={{ color: 'var(--cp)' }} />
                        </button>
                        <button
                          onClick={() => seleccionarProveedor(p)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          style={{
                            backgroundColor: proveedorSeleccionado?.id === p.id ? 'rgba(0,122,136,0.15)' : 'rgba(0,122,136,0.08)',
                            color: 'var(--cp)',
                          }}>
                          {proveedorSeleccionado?.id === p.id
                            ? <><ChevronUp size={13} /> Ocultar</>
                            : <><Eye size={13} /> Historial</>}
                        </button>
                        <button
                          onClick={() => setConfirmEliminar(p)}
                          disabled={eliminandoId === p.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar proveedor"
                        >
                          {eliminandoId === p.id
                            ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--cs)' }} />
                            : <Trash2 size={13} style={{ color: 'var(--cs)' }} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proveedoresFiltrados.length === 0 && (
              <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
                <Building2 size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No se encontraron proveedores</p>
              </div>
            )}
          </div>

          {/* Historial de transacciones */}
          {proveedorSeleccionado && (
            <div className="rounded-xl p-5 animar-entrada"
              style={{ backgroundColor: 'white', border: '1px solid rgba(0,122,136,0.2)' }}>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-base" style={{ color: 'var(--cd)' }}>
                    Historial de Pagos — {proveedorSeleccionado.razonSocial}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {transacciones.length} transaccion(es) · Total pagado:{' '}
                    <strong style={{ color: 'var(--cd)' }}>{formatearMoneda(totalPagadoProveedor)}</strong>
                  </p>
                </div>
                <button onClick={() => setMostrarFormPago(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: 'var(--cs)', color: 'white' }}>
                  <Plus size={14} /> Registrar Pago
                </button>
              </div>

              {cargandoTrx ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={22} className="animate-spin" style={{ color: 'var(--cp)' }} />
                </div>
              ) : transacciones.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                  <p className="text-sm">No hay pagos registrados para este proveedor.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Fecha', 'Hora', 'Concepto', 'Comprobante', 'Valor', 'Registrado por'].map(h => (
                        <th key={h} className="text-left pb-3 text-xs font-bold uppercase tracking-wide px-2"
                          style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transacciones.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td className="px-2 py-3 text-xs" style={{ color: 'var(--cd)' }}>
                          {formatearFechaCorta(t.fecha)}
                        </td>
                        <td className="px-2 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.hora || '—'}</td>
                        <td className="px-2 py-3 text-xs" style={{ color: 'var(--cd)' }}>{t.concepto}</td>
                        <td className="px-2 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {t.numeroComprobante}
                        </td>
                        <td className="px-2 py-3 text-xs font-semibold" style={{ color: '#059669' }}>
                          {formatearMoneda(t.valor)}
                        </td>
                        <td className="px-2 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {t.registradoPor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {mostrarFormProv && (
        <ModalProveedor
          proveedorEditar={proveedorEditar}
          registradoPorId={usuario.id}
          onCerrar={() => { setMostrarFormProv(false); setProveedorEditar(undefined); }}
          onGuardado={handleGuardadoProveedor}
        />
      )}

      {mostrarFormPago && proveedorSeleccionado && (
        <ModalNuevoPago
          proveedorId={proveedorSeleccionado.id}
          registradoPorId={usuario.id}
          onCerrar={() => setMostrarFormPago(false)}
          onGuardado={handleGuardadoPago}
        />
      )}

      {/* Modal confirmación eliminar proveedor */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4"
            style={{ backgroundColor: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(186,86,40,0.1)' }}>
                <Trash2 size={18} style={{ color: 'var(--cs)' }} />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--cd)' }}>
                  Eliminar proveedor
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Esta acción eliminará permanentemente a{' '}
                  <strong style={{ color: 'var(--cd)' }}>{confirmEliminar.razonSocial}</strong>{' '}
                  y todo su historial de pagos. No se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmEliminar(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEliminarProveedor(confirmEliminar)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: 'var(--cs)', color: 'white' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
