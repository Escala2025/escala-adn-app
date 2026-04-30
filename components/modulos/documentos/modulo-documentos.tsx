'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/contexto-auth';
import {
  obtenerDocumentosDeUsuario,
  obtenerTodosLosDocumentos,
  eliminarDocumento,
  type DocumentoPersonal,
} from '@/lib/actions/cobros-actions';
import { ETIQUETA_TIPO_DOCUMENTO } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// ÍCONOS SVG INLINE
// ─────────────────────────────────────────────────────────────────────────────
const IcoFolder    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const IcoArchivo   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IcoDescargar = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IcoEliminar  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IcoChevron   = ({ abierto }: { abierto: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 transition-transform ${abierto ? 'rotate-90' : ''}`}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IcoVacio     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-gray-300"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IcoBuscar    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function obtenerIniciales(nombre: string): string {
  const partes = nombre.trim().split(' ').filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function colorPorNombre(nombre: string): string {
  const colores = ['#007a88', '#1a1a2e', '#ba5628', '#0369a1', '#6d28d9', '#065f46'];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return colores[Math.abs(hash) % colores.length];
}

function formatearFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

/**
 * Descarga un documento usando el Route Handler /api/documentos/[id].
 * La decodificación base64 se hace en el servidor con Buffer de Node.js —
 * eliminando completamente los problemas de atob(), CSP y límites de tamaño.
 */
function descargarDocumento(documentoId: string) {
  const url    = `/api/documentos/${documentoId}`;
  const enlace = document.createElement('a');
  enlace.href     = url;
  enlace.download = '';              // el servidor envía Content-Disposition con el nombre real
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
}

const BADGE_TIPO: Record<string, { bg: string; color: string }> = {
  seg_social:       { bg: 'rgba(5,150,105,0.1)',   color: '#059669' },
  cert_bancario:    { bg: 'rgba(3,105,161,0.1)',   color: '#0369a1' },
  cuenta_cobro_pdf: { bg: 'rgba(0,122,136,0.1)',   color: 'var(--cp)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CONFIRMAR ELIMINACIÓN
// ─────────────────────────────────────────────────────────────────────────────

function ModalConfirmarEliminar({
  documento,
  onConfirmar,
  onCancelar,
  eliminando,
}: {
  documento: DocumentoPersonal;
  onConfirmar: () => void;
  onCancelar: () => void;
  eliminando: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onCancelar()}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(186,86,40,0.1)' }}>
            <IcoEliminar />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--cd)' }}>
              Eliminar documento
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer</p>
          </div>
        </div>

        <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--cl)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--cd)' }}>
            {documento.nombreArchivo}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {ETIQUETA_TIPO_DOCUMENTO[documento.tipoDocumento] ?? documento.tipoDocumento}
          </p>
        </div>

        <p className="text-xs text-gray-500 mb-5">
          El documento quedará registrado como eliminado con tu usuario y la fecha y hora exacta.
        </p>

        <div className="flex gap-3">
          <button onClick={onCancelar} disabled={eliminando}
            className="flex-1 py-2 text-sm rounded-xl border font-medium transition-colors"
            style={{ borderColor: 'var(--clm)', color: 'var(--cd)' }}>
            Cancelar
          </button>
          <button onClick={onConfirmar} disabled={eliminando}
            className="flex-1 py-2 text-sm rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: eliminando ? '#f87171' : '#ef4444', opacity: eliminando ? 0.7 : 1 }}>
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TARJETA DE DOCUMENTO
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaDocumento({
  doc,
  puedeEliminar,
  onEliminar,
}: {
  doc: DocumentoPersonal;
  puedeEliminar: boolean;
  onEliminar: (doc: DocumentoPersonal) => void;
}) {
  const badge = BADGE_TIPO[doc.tipoDocumento] ?? { bg: 'rgba(0,0,0,0.05)', color: '#666' };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors hover:border-[var(--cp)]"
      style={{ borderColor: 'var(--clm)', backgroundColor: 'white' }}>

      {/* Ícono */}
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: badge.bg, color: badge.color }}>
        <IcoArchivo />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--cd)' }}>
          {doc.nombreArchivo}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: badge.bg, color: badge.color }}>
            {ETIQUETA_TIPO_DOCUMENTO[doc.tipoDocumento] ?? doc.tipoDocumento}
          </span>
          <span className="text-[10px] text-gray-400">{formatearFecha(doc.creadoEn)}</span>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => descargarDocumento(doc.id)}
          title="Descargar"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--cl)]"
          style={{ color: 'var(--cp)' }}>
          <IcoDescargar />
        </button>
        {puedeEliminar && (
          <button
            onClick={() => onEliminar(doc)}
            title="Eliminar"
            className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
            style={{ color: '#ef4444' }}>
            <IcoEliminar />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARPETA DE USUARIO (solo vista maestra CEO/Contable)
// ─────────────────────────────────────────────────────────────────────────────

function CarpetaUsuario({
  nombreUsuario,
  documentos,
  onEliminar,
}: {
  nombreUsuario: string;
  documentos: DocumentoPersonal[];
  onEliminar: (doc: DocumentoPersonal) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const color = colorPorNombre(nombreUsuario);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--clm)' }}>
      {/* Cabecera carpeta */}
      <button
        onClick={() => setAbierta(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--cl)] transition-colors"
        style={{ backgroundColor: abierta ? 'rgba(0,122,136,0.04)' : 'white' }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: color }}>
          {obtenerIniciales(nombreUsuario)}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold" style={{ color: 'var(--cd)' }}>{nombreUsuario}</p>
          <p className="text-[11px] text-gray-400">{documentos.length} documento{documentos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="shrink-0" style={{ color: 'var(--cp)' }}>
          <IcoChevron abierto={abierta} />
        </div>
      </button>

      {/* Documentos */}
      {abierta && (
        <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: '1px solid var(--clm)' }}>
          {documentos.map(doc => (
            <TarjetaDocumento
              key={doc.id}
              doc={doc}
              puedeEliminar={true}
              onEliminar={onEliminar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloDocumentos() {
  const { usuario } = useAuth();

  const esMaestro = usuario?.rol === 'CEO' || usuario?.rol === 'Contable' || usuario?.rol === 'TI';

  const [documentos,    setDocumentos]    = useState<DocumentoPersonal[]>([]);
  const [cargando,      setCargando]      = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [busqueda,      setBusqueda]      = useState('');
  const [filtroTipo,    setFiltroTipo]    = useState<string>('');
  const [docAEliminar,  setDocAEliminar]  = useState<DocumentoPersonal | null>(null);
  const [eliminando,    setEliminando]    = useState(false);

  // ── Carga ─────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true); setError(null);
    try {
      const docs = esMaestro
        ? await obtenerTodosLosDocumentos()
        : await obtenerDocumentosDeUsuario(usuario.id);
      setDocumentos(Array.isArray(docs) ? docs : []);
    } catch (e) {
      setError('Error al cargar los documentos.');
      console.error('[Documentos] cargar:', e);
    } finally { setCargando(false); }
  }, [usuario, esMaestro]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Eliminar ──────────────────────────────────────────────────────────────

  const confirmarEliminar = useCallback(async () => {
    if (!docAEliminar || !usuario) return;
    setEliminando(true);
    try {
      const res = await eliminarDocumento(docAEliminar.id, usuario.id);
      if (res.ok) {
        setDocumentos(prev => prev.filter(d => d.id !== docAEliminar.id));
        setDocAEliminar(null);
      } else {
        setError(res.error ?? 'No se pudo eliminar.');
      }
    } finally { setEliminando(false); }
  }, [docAEliminar, usuario]);

  // ── Filtrado ──────────────────────────────────────────────────────────────

  const documentosFiltrados = useMemo(() => {
    return documentos.filter(d => {
      const coincideBusqueda = busqueda === '' ||
        d.nombreArchivo.toLowerCase().includes(busqueda.toLowerCase()) ||
        d.nombreUsuario.toLowerCase().includes(busqueda.toLowerCase());
      const coincideTipo = filtroTipo === '' || d.tipoDocumento === filtroTipo;
      return coincideBusqueda && coincideTipo;
    });
  }, [documentos, busqueda, filtroTipo]);

  // Para vista maestra: agrupar por usuario
  const carpetas = useMemo(() => {
    if (!esMaestro) return {};
    return documentosFiltrados.reduce<Record<string, { nombre: string; docs: DocumentoPersonal[] }>>(
      (acc, doc) => {
        if (!acc[doc.usuarioId]) acc[doc.usuarioId] = { nombre: doc.nombreUsuario, docs: [] };
        acc[doc.usuarioId].docs.push(doc);
        return acc;
      }, {}
    );
  }, [documentosFiltrados, esMaestro]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!usuario) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Cabecera */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--cl)', color: 'var(--cp)' }}>
            <IcoFolder />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cd)' }}>
              Documentos Personal
            </h1>
            <p className="text-xs text-gray-500">
              {esMaestro
                ? 'Repositorio maestro de documentos de todos los colaboradores'
                : 'Tus documentos generados automáticamente desde Cuentas de Cobro'}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { etiqueta: 'Total',            valor: documentos.length,                                              color: 'var(--cp)' },
          { etiqueta: 'Seg. Social',       valor: documentos.filter(d => d.tipoDocumento === 'seg_social').length,       color: '#059669' },
          { etiqueta: 'Cert. Bancario',    valor: documentos.filter(d => d.tipoDocumento === 'cert_bancario').length,    color: '#0369a1' },
          { etiqueta: 'Cuentas de Cobro',  valor: documentos.filter(d => d.tipoDocumento === 'cuenta_cobro_pdf').length, color: 'var(--cs)' },
        ].map(k => (
          <div key={k.etiqueta} className="rounded-2xl p-4" style={{ backgroundColor: 'white', border: '1px solid var(--clm)' }}>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.valor}</p>
            <p className="text-xs text-gray-500 mt-1">{k.etiqueta}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border"
          style={{ borderColor: 'var(--clm)', backgroundColor: 'white' }}>
          <span className="text-gray-400"><IcoBuscar /></span>
          <input
            type="text"
            placeholder={esMaestro ? 'Buscar por nombre o usuario...' : 'Buscar documento...'}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: 'var(--cd)' }}
          />
        </div>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border outline-none"
          style={{ borderColor: 'var(--clm)', color: 'var(--cd)', backgroundColor: 'white' }}>
          <option value="">Todos los tipos</option>
          <option value="seg_social">Planilla Seguridad Social</option>
          <option value="cert_bancario">Certificado Bancario</option>
          <option value="cuenta_cobro_pdf">Cuenta de Cobro (PDF)</option>
        </select>
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }} />
        </div>
      ) : error ? (
        <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'rgba(186,86,40,0.06)', border: '1px solid rgba(186,86,40,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--cs)' }}>{error}</p>
          <button onClick={cargar} className="mt-3 text-xs underline" style={{ color: 'var(--cp)' }}>
            Reintentar
          </button>
        </div>
      ) : documentosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <IcoVacio />
          <p className="text-sm font-medium mt-4" style={{ color: 'var(--cd)' }}>Sin documentos</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            {documentos.length === 0
              ? 'Los documentos aparecerán aquí automáticamente cuando se cree una Cuenta de Cobro.'
              : 'Ningún documento coincide con los filtros aplicados.'}
          </p>
        </div>
      ) : esMaestro ? (
        /* Vista maestra — carpetas por usuario */
        <div className="space-y-3">
          {Object.values(carpetas).map(({ nombre, docs }) => (
            <CarpetaUsuario
              key={nombre}
              nombreUsuario={nombre}
              documentos={docs}
              onEliminar={setDocAEliminar}
            />
          ))}
        </div>
      ) : (
        /* Vista personal — lista plana */
        <div className="space-y-2">
          {documentosFiltrados.map(doc => (
            <TarjetaDocumento
              key={doc.id}
              doc={doc}
              puedeEliminar={true}
              onEliminar={setDocAEliminar}
            />
          ))}
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {docAEliminar && (
        <ModalConfirmarEliminar
          documento={docAEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setDocAEliminar(null)}
          eliminando={eliminando}
        />
      )}
    </div>
  );
}
