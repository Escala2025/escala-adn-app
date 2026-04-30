/**
 * @fileoverview Módulo Gestor de Contraseñas Interno.
 * 100% dinámico: lee y escribe en la tabla `gestor_contrasenas` de PostgreSQL.
 *
 * Reglas de visibilidad (aplicadas en la Server Action):
 *   - CEO          : ve TODAS las contraseñas sin excepción.
 *   - TI           : ve todas EXCEPTO las del CEO.
 *   - Personal_base, Contable, Proveedor: solo las propias.
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Search, Eye, EyeOff, Copy, Check, X,
  ExternalLink, KeyRound, RefreshCw, Filter, Loader2,
  AlertCircle, Pencil, Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import {
  obtenerCredenciales,
  crearCredencial,
  actualizarCredencial,
  eliminarCredencial,
  obtenerUsuariosParaSelect,
} from '@/lib/actions/contrasenas-actions';
import { generarContrasena } from '@/lib/utilidades';
import type { Credencial, CategoriaCredencial } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIAS: CategoriaCredencial[] = [
  'Redes Sociales', 'Herramientas de Diseño', 'Servidores',
  'Email', 'CRM', 'Contabilidad', 'Almacenamiento', 'Otros',
];

const CATEGORIA_COLORES: Partial<Record<CategoriaCredencial, string>> = {
  'Servidores':             'rgba(124,58,237,0.1)',
  'Redes Sociales':         'rgba(0,122,136,0.1)',
  'Herramientas de Diseño': 'rgba(217,119,6,0.1)',
  'Email':                  'rgba(5,150,105,0.1)',
};

// ─────────────────────────────────────────────────────────────────────────────
// TARJETA DE CREDENCIAL
// ─────────────────────────────────────────────────────────────────────────────

interface TarjetaCredencialProps {
  credencial: Credencial;
  puedeEditar: boolean;
  onEditar: (c: Credencial) => void;
  onEliminar: (id: string) => void;
}

function TarjetaCredencial({ credencial, puedeEditar, onEditar, onEliminar }: TarjetaCredencialProps) {
  const [contrasenaVisible, setContrasenaVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const copiarContrasena = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(credencial.contrasena);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* El navegador bloqueó el portapapeles */
    }
  }, [credencial.contrasena]);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all hover:shadow-md"
      style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ backgroundColor: CATEGORIA_COLORES[credencial.categoria] ?? 'rgba(4,40,66,0.08)', color: 'var(--cd)' }}
          >
            {credencial.nombrePlataforma[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--cd)' }}>
              {credencial.nombrePlataforma}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
              {credencial.personaACargo}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(0,122,136,0.08)', color: 'var(--cp)' }}
          >
            {credencial.categoria}
          </span>
          {puedeEditar && (
            <>
              <button
                onClick={() => onEditar(credencial)}
                className="p-1.5 rounded-lg"
                title="Editar"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => onEliminar(credencial.id)}
                className="p-1.5 rounded-lg"
                title="Eliminar"
                style={{ color: 'var(--cs)' }}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Campo contraseña */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ backgroundColor: 'rgba(4,40,66,0.04)', border: '1px solid var(--border)' }}
      >
        <KeyRound size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        <span
          className="flex-1 text-sm font-mono truncate"
          style={{
            color: contrasenaVisible ? 'var(--cd)' : 'var(--muted-foreground)',
            letterSpacing: contrasenaVisible ? 'normal' : '0.15em',
          }}
        >
          {contrasenaVisible ? credencial.contrasena : '••••••••••••'}
        </span>
        <button
          onClick={() => setContrasenaVisible(p => !p)}
          className="p-1 rounded"
          title={contrasenaVisible ? 'Ocultar' : 'Revelar'}
        >
          {contrasenaVisible
            ? <EyeOff size={14} style={{ color: 'var(--muted-foreground)' }} />
            : <Eye size={14} style={{ color: 'var(--cp)' }} />}
        </button>
        <button onClick={copiarContrasena} className="p-1 rounded" title="Copiar contraseña">
          {copiado
            ? <Check size={14} style={{ color: '#059669' }} />
            : <Copy size={14} style={{ color: 'var(--muted-foreground)' }} />}
        </button>
      </div>

      {/* Link */}
      {credencial.linkPlataforma && (
        <a
          href={credencial.linkPlataforma}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs transition-colors hover:underline"
          style={{ color: 'var(--cp)' }}
        >
          <ExternalLink size={11} />
          {credencial.linkPlataforma}
        </a>
      )}

      {/* Notas */}
      {credencial.notas && (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {credencial.notas}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIO CREAR / EDITAR CREDENCIAL
// ─────────────────────────────────────────────────────────────────────────────

interface UsuarioSelectItem {
  id: string;
  nombreCompleto: string;
  cargo: string;
}

interface FormCredencialProps {
  credencialEditar?: Credencial;
  onCerrar: () => void;
  onGuardado: () => void;
  usuarioActualId: string;
  esAdmin: boolean;
  usuariosDisponibles: UsuarioSelectItem[];
}

function FormCredencial({
  credencialEditar, onCerrar, onGuardado,
  usuarioActualId, esAdmin, usuariosDisponibles,
}: FormCredencialProps) {
  const usuarioInicial = usuariosDisponibles.find(u => u.id === usuarioActualId);
  const [form, setForm] = useState({
    propietarioId:    credencialEditar?.usuarioId    ?? usuarioActualId,
    personaACargo:    credencialEditar?.personaACargo ?? (usuarioInicial?.nombreCompleto ?? ''),
    nombrePlataforma: credencialEditar?.nombrePlataforma ?? '',
    linkPlataforma:   credencialEditar?.linkPlataforma  ?? '',
    contrasena:       credencialEditar?.contrasena      ?? '',
    categoria:        credencialEditar?.categoria        ?? ('Otros' as CategoriaCredencial),
    notas:            credencialEditar?.notas           ?? '',
  });
  const [mostrarPass, setMostrarPass] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const actualizar = (campo: string, valor: string) =>
    setForm(p => ({ ...p, [campo]: valor }));

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombrePlataforma || !form.contrasena) return;
    setGuardando(true);
    setError('');
    try {
      let res;
      if (credencialEditar) {
        res = await actualizarCredencial({
          id:              credencialEditar.id,
          propietarioId:   form.propietarioId,
          personaACargo:   form.personaACargo,
          nombrePlataforma: form.nombrePlataforma,
          linkPlataforma:  form.linkPlataforma,
          contrasena:      form.contrasena,
          categoria:       form.categoria,
          notas:           form.notas,
        });
      } else {
        res = await crearCredencial({
          propietarioId:   form.propietarioId,
          personaACargo:   form.personaACargo,
          nombrePlataforma: form.nombrePlataforma,
          linkPlataforma:  form.linkPlataforma,
          contrasena:      form.contrasena,
          categoria:       form.categoria,
          notas:           form.notas,
        });
      }
      if (res.ok) {
        onGuardado();
      } else {
        setError(res.error ?? 'Error al guardar la credencial.');
      }
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
          <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>
            {credencialEditar ? 'Editar Credencial' : 'Nueva Credencial'}
          </h2>
          <button onClick={onCerrar}><X size={18} style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
            <AlertCircle size={14} />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
          {/* Persona a cargo */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
              Persona a cargo
            </label>
            {esAdmin && usuariosDisponibles.length > 0 ? (
              <select
                value={form.propietarioId}
                onChange={e => {
                  const u = usuariosDisponibles.find(u => u.id === e.target.value);
                  setForm(p => ({ ...p, propietarioId: e.target.value, personaACargo: u?.nombreCompleto ?? '' }));
                }}
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
              >
                {usuariosDisponibles.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombreCompleto} {u.cargo ? `(${u.cargo})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                readOnly
                value={form.personaACargo}
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'rgba(0,0,0,0.03)', outline: 'none' }}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
              Nombre de la Plataforma *
            </label>
            <input
              value={form.nombrePlataforma}
              onChange={e => actualizar('nombrePlataforma', e.target.value)}
              placeholder="Ej: Canva, AWS, Mailchimp"
              required
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
              Link de la Plataforma
            </label>
            <input
              value={form.linkPlataforma}
              onChange={e => actualizar('linkPlataforma', e.target.value)}
              placeholder="https://"
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
              Categoría
            </label>
            <select
              value={form.categoria}
              onChange={e => actualizar('categoria', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
            >
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
              Contraseña *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={mostrarPass ? 'text' : 'password'}
                  value={form.contrasena}
                  onChange={e => actualizar('contrasena', e.target.value)}
                  placeholder="Contraseña de la plataforma"
                  required
                  className="w-full px-3 py-2.5 pr-9 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPass(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                >
                  {mostrarPass
                    ? <EyeOff size={13} style={{ color: 'var(--muted-foreground)' }} />
                    : <Eye size={13} style={{ color: 'var(--cp)' }} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { actualizar('contrasena', generarContrasena()); setMostrarPass(true); }}
                className="px-3 rounded-lg text-sm font-medium flex items-center gap-1 flex-shrink-0"
                style={{ backgroundColor: 'rgba(0,122,136,0.1)', color: 'var(--cp)', border: '1px solid rgba(0,122,136,0.2)' }}
              >
                <RefreshCw size={13} /> Generar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
              Notas (opcional)
            </label>
            <textarea
              value={form.notas}
              onChange={e => actualizar('notas', e.target.value)}
              rows={2}
              placeholder="Información adicional sobre esta credencial..."
              className="w-full px-3 py-2.5 rounded-lg text-sm border resize-none"
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
              {guardando && <Loader2 size={14} className="animate-spin" />}
              {credencialEditar ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloContrasenas() {
  const { usuario } = useAuth();
  const [credenciales, setCredenciales] = useState<Credencial[]>([]);
  const [usuariosSelect, setUsuariosSelect] = useState<UsuarioSelectItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaCredencial | 'Todas'>('Todas');
  const [formulario, setFormulario] = useState<'nuevo' | Credencial | null>(null);

  // Calcular antes del return condicional para no violar reglas de hooks
  const esAdmin = usuario?.rol === 'CEO' || usuario?.rol === 'TI';

  /** Carga las credenciales y los usuarios para el selector. */
  const cargarDatos = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setErrorCarga('');
    try {
      const [resCredenciales, resUsuarios] = await Promise.all([
        obtenerCredenciales(usuario.id, usuario.rol),
        esAdmin ? obtenerUsuariosParaSelect() : Promise.resolve({ ok: true, datos: [] as UsuarioSelectItem[] }),
      ]);
      if (resCredenciales.ok && resCredenciales.datos) {
        setCredenciales(resCredenciales.datos);
      } else {
        setErrorCarga(resCredenciales.error ?? 'Error al cargar las credenciales.');
      }
      if (resUsuarios.ok && resUsuarios.datos) {
        setUsuariosSelect(resUsuarios.datos);
      }
    } finally {
      setCargando(false);
    }
  }, [usuario, esAdmin]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  /** Borra una credencial con confirmación. */
  const manejarEliminar = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta credencial? Esta acción no se puede deshacer.')) return;
    const res = await eliminarCredencial(id);
    if (res.ok) {
      setCredenciales(p => p.filter(c => c.id !== id));
    } else {
      setErrorCarga(res.error ?? 'Error al eliminar.');
    }
  }, []);

  const credencialesFiltradas = useMemo(() => {
    let lista = credenciales;

    if (busqueda) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(c =>
        c.nombrePlataforma.toLowerCase().includes(q) ||
        c.personaACargo.toLowerCase().includes(q)
      );
    }

    if (filtroCategoria !== 'Todas') {
      lista = lista.filter(c => c.categoria === filtroCategoria);
    }

    return lista;
  }, [credenciales, busqueda, filtroCategoria]);

  if (!usuario) return null;

  if (cargando) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Cargando bóveda de contraseñas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>Gestor de Contraseñas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {usuario.rol === 'CEO'
              ? `Bóveda corporativa — acceso total: ${credencialesFiltradas.length} credencial(es)`
              : usuario.rol === 'TI'
              ? `Bóveda del equipo — ${credencialesFiltradas.length} credencial(es) visibles`
              : `Mis credenciales — ${credencialesFiltradas.length} registradas`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargarDatos}
            className="p-2 rounded-xl border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            title="Actualizar lista"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setFormulario('nuevo')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: 'var(--cp)', color: 'white', boxShadow: '0 4px 12px rgba(0,122,136,0.25)' }}
          >
            <Plus size={16} /> Nueva Contraseña
          </button>
        </div>
      </div>

      {/* Banner de error */}
      {errorCarga && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ backgroundColor: 'rgba(186,86,40,0.1)', border: '1px solid rgba(186,86,40,0.25)' }}
        >
          <AlertCircle size={16} style={{ color: 'var(--cs)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--cs)' }}>{errorCarga}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar plataforma o responsable..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
          />
        </div>
        <div className="relative flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value as CategoriaCredencial | 'Todas')}
            className="pl-2 pr-8 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
          >
            <option value="Todas">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Grilla de credenciales */}
      {credencialesFiltradas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {credencialesFiltradas.map(c => (
            <TarjetaCredencial
              key={c.id}
              credencial={c}
              puedeEditar={esAdmin || c.usuarioId === usuario.id}
              onEditar={cred => setFormulario(cred)}
              onEliminar={manejarEliminar}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <KeyRound size={40} className="mb-3 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
          <p className="font-semibold" style={{ color: 'var(--cd)' }}>Sin credenciales registradas</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Usa el botón &quot;Nueva Contraseña&quot; para agregar una.
          </p>
        </div>
      )}

      {/* Modal crear / editar */}
      {formulario !== null && (
        <FormCredencial
          credencialEditar={formulario === 'nuevo' ? undefined : formulario}
          onCerrar={() => setFormulario(null)}
          onGuardado={() => { setFormulario(null); cargarDatos(); }}
          usuarioActualId={usuario.id}
          esAdmin={esAdmin}
          usuariosDisponibles={usuariosSelect}
        />
      )}
    </div>
  );
}
