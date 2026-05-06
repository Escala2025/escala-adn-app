'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Building2, Search, Plus, X, Check,
  ChevronUp, DollarSign, Eye, RefreshCw, Loader2, AlertCircle, Pencil, Trash2, Download, Upload,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import {
  obtenerProveedores, crearProveedor, actualizarProveedor,
  obtenerTransacciones, crearTransaccion, eliminarProveedor,
  registrarProveedorConDocumentos, obtenerDocumentosProveedor, obtenerDocumentoProveedor, actualizarDocumentoProveedor,
} from '@/lib/actions/proveedores-actions';
import { esContador, formatearMoneda, formatearFechaCorta } from '@/lib/utilidades';
import type {
  Proveedor, TransaccionProveedor, RegimenTributario, TipoDocumentoProveedor, DocumentoProveedor,
} from '@/lib/tipos';
import {
  ETIQUETA_TIPO_DOCUMENTO_PROVEEDOR,
  TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS,
} from '@/lib/tipos';

const REGIMENES: RegimenTributario[] = [
  'Responsable de IVA', 'No Responsable de IVA', 'Gran Contribuyente', 'Régimen Simple',
];

type DocumentoInput = { nombreArchivo: string; mimeType: string; contenidoBase64: string };

interface ModalProveedorProps {
  proveedorEditar?: Proveedor;
  registradoPorId: string;
  onCerrar: () => void;
  onGuardado: () => void;
}

function ModalProveedor({ proveedorEditar, registradoPorId, onCerrar, onGuardado }: ModalProveedorProps) {
  const esEdicion = !!proveedorEditar;
  const [form, setForm] = useState({
    razonSocial: proveedorEditar?.razonSocial ?? '',
    nitCedula: proveedorEditar?.nitCedula ?? '',
    direccion: proveedorEditar?.direccion ?? '',
    ciudad: proveedorEditar?.ciudad ?? '',
    telefono: proveedorEditar?.telefono ?? '',
    correo: proveedorEditar?.correo ?? '',
    regimen: (proveedorEditar?.regimen ?? 'No Responsable de IVA') as RegimenTributario,
    responsabilidadesFiscales: proveedorEditar?.responsabilidadesFiscales ?? '',
    servicios: proveedorEditar?.servicios ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');
  const [documentos, setDocumentos] = useState<Record<TipoDocumentoProveedor, DocumentoInput | null>>(
    () => Object.fromEntries(TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS.map(t => [t, null])) as Record<TipoDocumentoProveedor, DocumentoInput | null>,
  );

  const actualizar = (c: string, v: string) => setForm(p => ({ ...p, [c]: v }));

  const leerArchivoBase64 = (archivo: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? ''));
      fr.onerror = () => reject(new Error('Error leyendo archivo'));
      fr.readAsDataURL(archivo);
    });

  const onSeleccionarDocumento = async (tipo: TipoDocumentoProveedor, archivo: File | null) => {
    if (!archivo) return;
    if (archivo.type !== 'application/pdf') {
      setErrorServidor(`"${ETIQUETA_TIPO_DOCUMENTO_PROVEEDOR[tipo]}" debe ser PDF.`);
      return;
    }
    try {
      const contenidoBase64 = await leerArchivoBase64(archivo);
      setDocumentos(prev => ({
        ...prev,
        [tipo]: { nombreArchivo: archivo.name, mimeType: archivo.type, contenidoBase64 },
      }));
      setErrorServidor('');
    } catch {
      setErrorServidor('No se pudo procesar el archivo.');
    }
  };

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razonSocial || !form.nitCedula) return;
    setGuardando(true);
    setErrorServidor('');
    try {
      const payload = { ...form, registradoPorId };
      const resultado = esEdicion && proveedorEditar
        ? await actualizarProveedor(proveedorEditar.id, payload)
        : await registrarProveedorConDocumentos({
            ...payload,
            documentos: TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS.map((tipo) => {
              const doc = documentos[tipo];
              if (!doc) return null;
              return { tipoDocumento: tipo, ...doc };
            }).filter(Boolean) as { tipoDocumento: TipoDocumentoProveedor; nombreArchivo: string; mimeType: string; contenidoBase64: string }[],
          });

      if (!esEdicion) {
        const faltantes = TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS.filter(t => !documentos[t]);
        if (faltantes.length > 0) {
          setErrorServidor('Debes adjuntar los 6 documentos PDF obligatorios.');
          setGuardando(false);
          return;
        }
      }

      if (resultado.ok) onGuardado();
      else setErrorServidor(resultado.error ?? 'Error desconocido');
    } catch {
      setErrorServidor('Error de conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-fondo" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="w-full max-w-2xl mx-4 rounded-2xl p-6 animar-entrada overflow-y-auto" style={{ backgroundColor: 'white', maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>{esEdicion ? 'Editar Proveedor' : 'Registrar Proveedor'}</h2>
          <button onClick={onCerrar}><X size={18} style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>

        {errorServidor && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm" style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
            <AlertCircle size={15} />{errorServidor}
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input className="col-span-2 w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.razonSocial} onChange={e => actualizar('razonSocial', e.target.value)} placeholder="Razón Social / Nombre *" required />
            <input className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.nitCedula} onChange={e => actualizar('nitCedula', e.target.value)} placeholder="NIT / Cédula *" required />
            <input className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.telefono} onChange={e => actualizar('telefono', e.target.value)} placeholder="Teléfono" />
            <input className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.correo} onChange={e => actualizar('correo', e.target.value)} placeholder="Correo" />
            <input className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.ciudad} onChange={e => actualizar('ciudad', e.target.value)} placeholder="Ciudad" />
            <input className="col-span-2 w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.direccion} onChange={e => actualizar('direccion', e.target.value)} placeholder="Dirección" />
            <select className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.regimen} onChange={e => actualizar('regimen', e.target.value)}>
              {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border)' }} value={form.responsabilidadesFiscales} onChange={e => actualizar('responsabilidadesFiscales', e.target.value)} placeholder="Responsabilidades fiscales" />
            <textarea className="col-span-2 w-full px-3 py-2.5 rounded-lg text-sm border resize-none" style={{ borderColor: 'var(--border)' }} rows={2} value={form.servicios} onChange={e => actualizar('servicios', e.target.value)} placeholder="Servicios" />
          </div>

          {!esEdicion && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--cp)' }}>Documentos obligatorios (PDF)</p>
              <div className="grid grid-cols-1 gap-2">
                {TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS.map(tipo => (
                  <div key={tipo}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>{ETIQUETA_TIPO_DOCUMENTO_PROVEEDOR[tipo]} *</label>
                    <input type="file" accept="application/pdf,.pdf" required onChange={e => onSeleccionarDocumento(tipo, e.target.files?.[0] ?? null)} className="w-full px-3 py-2.5 rounded-lg text-sm border bg-white" style={{ borderColor: 'var(--border)' }} />
                    <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{documentos[tipo]?.nombreArchivo ?? 'Sin archivo seleccionado'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--cp)', color: 'white' }}>
              {guardando ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Check size={15} /> {esEdicion ? 'Actualizar' : 'Registrar Proveedor'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ModalNuevoPagoProps {
  proveedorId: string;
  registradoPorId: string;
  onCerrar: () => void;
  onGuardado: () => void;
}

function ModalNuevoPago({ proveedorId, registradoPorId, onCerrar, onGuardado }: ModalNuevoPagoProps) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    hora: new Date().toTimeString().slice(0, 5),
    valor: '',
    concepto: '',
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
        valor: parseFloat(form.valor.replace(/\./g, '')),
        concepto: form.concepto,
        numeroComprobante: form.numeroComprobante || undefined,
        fecha: form.fecha,
        hora: form.hora,
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
      <div
        className="w-full max-w-md mx-4 rounded-2xl p-6 animar-entrada"
        style={{ backgroundColor: 'white', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>Registrar Pago</h2>
          <button onClick={onCerrar}><X size={18} style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
            style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}
          >
            <AlertCircle size={15} />{error}
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Hora</label>
              <input
                type="time"
                value={form.hora}
                onChange={e => setForm(p => ({ ...p, hora: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Valor (COP) *</label>
            <input
              value={form.valor}
              onChange={e => setForm(p => ({ ...p, valor: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder="Ej: 2500000"
              required
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Concepto *</label>
            <input
              value={form.concepto}
              onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
              placeholder="Ej: Flete transporte materiales"
              required
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>N° Comprobante</label>
            <input
              value={form.numeroComprobante}
              onChange={e => setForm(p => ({ ...p, numeroComprobante: e.target.value }))}
              placeholder="COMP-2025-0001"
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--cp)', color: 'white', opacity: guardando ? 0.7 : 1 }}
            >
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

export default function ModuloProveedores() {
  const { usuario } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [transacciones, setTransacciones] = useState<TransaccionProveedor[]>([]);
  const [documentosProveedor, setDocumentosProveedor] = useState<DocumentoProveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoTrx, setCargandoTrx] = useState(false);
  const [cargandoDocs, setCargandoDocs] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);
  const [mostrarFormProv, setMostrarFormProv] = useState(false);
  const [proveedorEditar, setProveedorEditar] = useState<Proveedor | undefined>();
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState<Proveedor | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [actualizandoDoc, setActualizandoDoc] = useState<string | null>(null);

  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const r = await obtenerProveedores();
      if (r.ok && r.datos) setProveedores(r.datos);
      else setErrorCarga(r.error ?? 'Error al cargar proveedores.');
    } catch {
      setErrorCarga('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarTransacciones = useCallback(async (proveedorId: string) => {
    setCargandoTrx(true);
    try {
      const r = await obtenerTransacciones(proveedorId);
      if (r.ok && r.datos) setTransacciones(r.datos);
      else setTransacciones([]);
    } finally {
      setCargandoTrx(false);
    }
  }, []);

  const cargarDocumentos = useCallback(async (proveedorId: string) => {
    setCargandoDocs(true);
    try {
      const r = await obtenerDocumentosProveedor(proveedorId);
      if (r.ok && r.datos) setDocumentosProveedor(r.datos);
      else setDocumentosProveedor([]);
    } finally {
      setCargandoDocs(false);
    }
  }, []);

  useEffect(() => { cargarProveedores(); }, [cargarProveedores]);

  const seleccionarProveedor = useCallback((p: Proveedor) => {
    if (proveedorSeleccionado?.id === p.id) {
      setProveedorSeleccionado(null);
      setTransacciones([]);
      setDocumentosProveedor([]);
      return;
    }
    setProveedorSeleccionado(p);
    cargarTransacciones(p.id);
    cargarDocumentos(p.id);
  }, [proveedorSeleccionado, cargarTransacciones, cargarDocumentos]);

  const proveedoresFiltrados = useMemo(() =>
    proveedores.filter(p =>
      p.razonSocial.toLowerCase().includes(busqueda.toLowerCase()) || p.nitCedula.includes(busqueda),
    ),
    [proveedores, busqueda],
  );

  const totalPagadoProveedor = useMemo(() => transacciones.reduce((acc, t) => acc + t.valor, 0), [transacciones]);

  const handleGuardadoProveedor = () => {
    setMostrarFormProv(false);
    setProveedorEditar(undefined);
    cargarProveedores();
  };

  const handleGuardadoPago = () => {
    setMostrarFormPago(false);
    if (proveedorSeleccionado) cargarTransacciones(proveedorSeleccionado.id);
  };

  const handleEliminarProveedor = async (p: Proveedor) => {
    setEliminandoId(p.id);
    try {
      const r = await eliminarProveedor(p.id);
      if (r.ok) {
        if (proveedorSeleccionado?.id === p.id) {
          setProveedorSeleccionado(null);
          setTransacciones([]);
          setDocumentosProveedor([]);
        }
        cargarProveedores();
      } else setErrorCarga(r.error ?? 'No se pudo eliminar.');
    } finally {
      setEliminandoId(null);
      setConfirmEliminar(null);
    }
  };

  const descargarDocumento = async (tipo: TipoDocumentoProveedor) => {
    if (!proveedorSeleccionado) return;
    const r = await obtenerDocumentoProveedor(proveedorSeleccionado.id, tipo);
    if (!r.ok || !r.datos?.contenidoBase64) {
      setErrorCarga(r.error ?? 'No se pudo descargar documento.');
      return;
    }
    const contenido = r.datos.contenidoBase64;
    const href = contenido.startsWith('data:') ? contenido : `data:application/pdf;base64,${contenido}`;
    const a = document.createElement('a');
    a.href = href;
    a.download = r.datos.nombreArchivo.toLowerCase().endsWith('.pdf') ? r.datos.nombreArchivo : `${r.datos.nombreArchivo}.pdf`;
    a.click();
  };

  const actualizarDoc = async (tipo: TipoDocumentoProveedor, archivo: File | null) => {
    if (!proveedorSeleccionado || !archivo) return;
    if (archivo.type !== 'application/pdf') {
      setErrorCarga('Solo se permiten archivos PDF.');
      return;
    }
    setActualizandoDoc(tipo);
    try {
      const contenidoBase64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result ?? ''));
        fr.onerror = () => reject(new Error('Error'));
        fr.readAsDataURL(archivo);
      });
      const r = await actualizarDocumentoProveedor({
        proveedorId: proveedorSeleccionado.id,
        tipoDocumento: tipo,
        nombreArchivo: archivo.name,
        mimeType: archivo.type,
        contenidoBase64,
      });
      if (!r.ok) setErrorCarga(r.error ?? 'No se pudo actualizar documento.');
      else await cargarDocumentos(proveedorSeleccionado.id);
    } catch {
      setErrorCarga('Error al procesar documento.');
    } finally {
      setActualizandoDoc(null);
    }
  };

  if (!usuario || !esContador(usuario.rol)) {
    return <div className="p-6">Acceso restringido.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>Gestión de Proveedores</h1>
        <button onClick={() => { setProveedorEditar(undefined); setMostrarFormProv(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: 'var(--cp)', color: 'white' }}>
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o NIT..." className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border" />
        </div>
        <button onClick={cargarProveedores} disabled={cargando} className="p-2.5 rounded-xl border"><RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /></button>
      </div>

      {errorCarga && <div className="text-sm" style={{ color: 'var(--cs)' }}>{errorCarga}</div>}

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'white',
          border: '1px solid rgba(4,40,66,0.08)',
          boxShadow: '0 10px 30px rgba(4,40,66,0.06)',
        }}
      >
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'rgba(0,122,136,0.06)' }}>
            <tr>
              {['Proveedor', 'NIT', 'Ciudad', 'Régimen', 'Servicios', 'Acciones'].map(h => (
                <th
                  key={h}
                  className="text-left px-6 py-4 text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ color: 'var(--cd)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proveedoresFiltrados.map((p, idx) => (
              <tr
                key={p.id}
                className="transition-colors"
                style={{
                  backgroundColor: proveedorSeleccionado?.id === p.id
                    ? 'rgba(0,122,136,0.10)'
                    : idx % 2 === 0
                      ? 'white'
                      : 'rgba(4,40,66,0.02)',
                }}
                onMouseEnter={(e) => {
                  if (proveedorSeleccionado?.id !== p.id) {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(0,122,136,0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                    proveedorSeleccionado?.id === p.id
                      ? 'rgba(0,122,136,0.10)'
                      : idx % 2 === 0
                        ? 'white'
                        : 'rgba(4,40,66,0.02)';
                }}
              >
                <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cd)' }}>{p.razonSocial}</td>
                <td className="px-6 py-4" style={{ color: 'var(--cd)' }}>{p.nitCedula}</td>
                <td className="px-6 py-4" style={{ color: 'var(--cd)' }}>{p.ciudad || '—'}</td>
                <td className="px-6 py-4" style={{ color: 'var(--cd)' }}>{p.regimen}</td>
                <td className="px-6 py-4 max-w-[320px]">
                  <span className="block truncate" title={p.servicios || '—'} style={{ color: 'var(--cd)' }}>
                    {p.servicios || '—'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setProveedorEditar(p); setMostrarFormProv(true); }}
                      className="p-2 rounded-lg border transition-colors hover:bg-slate-50"
                      style={{ borderColor: 'rgba(4,40,66,0.12)', color: 'var(--cd)' }}
                      title="Editar proveedor"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      onClick={() => seleccionarProveedor(p)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: 'rgba(0,122,136,0.08)',
                        borderColor: 'rgba(0,122,136,0.2)',
                        color: 'var(--cp)',
                      }}
                    >
                      {proveedorSeleccionado?.id === p.id ? <><ChevronUp size={13} /> Ocultar</> : <><Eye size={13} /> Detalle</>}
                    </button>

                    <button
                      onClick={() => setConfirmEliminar(p)}
                      disabled={eliminandoId === p.id}
                      className="p-2 rounded-lg border transition-colors hover:bg-red-50 disabled:opacity-60"
                      style={{ borderColor: 'rgba(186,86,40,0.2)', color: 'var(--cs)' }}
                      title="Eliminar proveedor"
                    >
                      {eliminandoId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {proveedorSeleccionado && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'white', border: '1px solid rgba(0,122,136,0.2)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Historial de pagos — {proveedorSeleccionado.razonSocial}</h2>
            <button onClick={() => setMostrarFormPago(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: 'var(--cs)', color: 'white' }}>
              <Plus size={14} /> Registrar Pago
            </button>
          </div>
          {cargandoTrx ? <Loader2 size={20} className="animate-spin" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr>{['Fecha', 'Hora', 'Concepto', 'Comprobante', 'Valor', 'Registrado por'].map(h => <th key={h} className="text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {transacciones.map(t => (
                  <tr key={t.id}>
                    <td>{formatearFechaCorta(t.fecha)}</td>
                    <td>{t.hora || '—'}</td>
                    <td>{t.concepto}</td>
                    <td>{t.numeroComprobante}</td>
                    <td>{formatearMoneda(t.valor)}</td>
                    <td>{t.registradoPor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-sm mt-2">Total pagado: <strong>{formatearMoneda(totalPagadoProveedor)}</strong></p>
        </div>
      )}

      {proveedorSeleccionado && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'white', border: '1px solid rgba(4,40,66,0.12)' }}>
          <h2 className="font-bold mb-3">Carpeta documental — {proveedorSeleccionado.razonSocial}</h2>
          {cargandoDocs ? <Loader2 size={20} className="animate-spin" /> : (
            <div className="space-y-3">
              {TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS.map(tipo => {
                const doc = documentosProveedor.find(d => d.tipoDocumento === tipo);
                return (
                  <div key={tipo} className="rounded-lg p-3 border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{ETIQUETA_TIPO_DOCUMENTO_PROVEEDOR[tipo]}</p>
                      <p className="text-xs">{doc?.nombreArchivo ?? 'No cargado'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => descargarDocumento(tipo)} disabled={!doc} className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50">
                        <Download size={12} className="inline mr-1" /> Descargar
                      </button>
                      <label className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: 'var(--cp)', color: 'white' }}>
                        <Upload size={12} className="inline mr-1" /> {actualizandoDoc === tipo ? 'Actualizando…' : 'Actualizar'}
                        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => actualizarDoc(tipo, e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor: 'white' }}>
            <p className="text-sm">¿Eliminar proveedor <strong>{confirmEliminar.razonSocial}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEliminar(null)} className="flex-1 py-2.5 rounded-xl border">Cancelar</button>
              <button onClick={() => handleEliminarProveedor(confirmEliminar)} className="flex-1 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--cs)', color: 'white' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
