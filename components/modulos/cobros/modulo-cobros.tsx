/**
 * @fileoverview Módulo de Cuentas de Cobro y Pagos.
 * Flujo completo: Formulario de diligenciamiento → Gestión Documental → Tablero Contable.
 * Incluye firma digital en canvas, generación de PDF estructurado y
 * vista diferenciada según el rol del usuario.
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  FileText, Upload, CheckCircle, XCircle, Eye, Send,
  X, AlertCircle, Download, MessageSquare, Plus, Filter,
  Calendar, PenLine, Trash2, Check,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import {
  obtenerTodasLasCuentas, obtenerCuentasDeUsuario,
  crearCuentaCobro, actualizarEstadoCuenta, marcarComoPagada,
} from '@/lib/actions/cobros-actions';
import { DollarSign } from 'lucide-react';
import { esContador, formatearMoneda, formatearFechaCorta, numeroALetras, claseEstadoCuenta } from '@/lib/utilidades';
import type { CuentaCobro, TipoCuentaBancaria, EstadoCuentaCobro } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS DE FIRMA DIGITAL
// ─────────────────────────────────────────────────────────────────────────────

interface CanvasFirmaProps {
  onFirmar: (dataUrl: string) => void;
  onLimpiar: () => void;
  firmada: boolean;
}

function CanvasFirma({ onFirmar, onLimpiar, firmada }: CanvasFirmaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujandoRef = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#042842';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const obtenerPosicion = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniciarTrazo = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    dibujandoRef.current = true;
    const pos = obtenerPosicion(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const continuarTrazo = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dibujandoRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const pos = obtenerPosicion(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setTieneTrazo(true);
  };

  const finalizarTrazo = () => {
    dibujandoRef.current = false;
    if (tieneTrazo && canvasRef.current) {
      onFirmar(canvasRef.current.toDataURL('image/png'));
    }
  };

  const limpiarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
    onLimpiar();
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="lienzo-firma w-full"
          style={{ touchAction: 'none' }}
          onMouseDown={iniciarTrazo}
          onMouseMove={continuarTrazo}
          onMouseUp={finalizarTrazo}
          onMouseLeave={finalizarTrazo}
          onTouchStart={iniciarTrazo}
          onTouchMove={continuarTrazo}
          onTouchEnd={finalizarTrazo}
        />
        {!tieneTrazo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
              <PenLine size={13} /> Firme aquí con el ratón o dedo
            </p>
          </div>
        )}
      </div>
      {tieneTrazo && (
        <button
          type="button"
          onClick={limpiarCanvas}
          className="text-xs flex items-center gap-1"
          style={{ color: 'var(--cs)' }}
        >
          <Trash2 size={11} /> Limpiar firma
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONA DE CARGA DE ARCHIVOS (DRAG & DROP)
// ─────────────────────────────────────────────────────────────────────────────

interface ZonaCargaProps {
  label: string;
  descripcion: string;
  archivo: File | null;
  onSeleccionar: (f: File | null) => void;
  obligatorio?: boolean;
}

function ZonaCarga({ label, descripcion, archivo, onSeleccionar, obligatorio }: ZonaCargaProps) {
  const [dragActivo, setDragActivo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const procesarArchivo = (f: File) => {
    if (f.type === 'application/pdf' || f.type.startsWith('image/')) {
      onSeleccionar(f);
    }
  };

  const manejarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActivo(false);
    const f = e.dataTransfer.files[0];
    if (f) procesarArchivo(f);
  };

  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
        {label} {obligatorio && <span style={{ color: 'var(--cs)' }}>*</span>}
      </label>
      <div
        onClick={() => !archivo && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragActivo(true); }}
        onDragLeave={() => setDragActivo(false)}
        onDrop={manejarDrop}
        className="rounded-xl p-4 flex items-center gap-3 transition-all"
        style={{
          border: `1.5px dashed ${archivo ? '#059669' : dragActivo ? 'var(--cp)' : 'var(--border)'}`,
          backgroundColor: archivo ? 'rgba(5,150,105,0.04)' : dragActivo ? 'rgba(0,122,136,0.04)' : 'rgba(0,0,0,0.02)',
          cursor: archivo ? 'default' : 'pointer',
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: archivo ? 'rgba(5,150,105,0.1)' : 'rgba(0,122,136,0.08)' }}
        >
          {archivo
            ? <CheckCircle size={18} style={{ color: '#059669' }} />
            : <Upload size={18} style={{ color: 'var(--cp)' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: archivo ? '#059669' : 'var(--cd)' }}>
            {archivo ? archivo.name : label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {archivo ? `${(archivo.size / 1024).toFixed(0)} KB` : descripcion}
          </p>
        </div>
        {archivo && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onSeleccionar(null); }}
            className="p-1 rounded-lg"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIO DE CUENTA DE COBRO
// ─────────────────────────────────────────────────────────────────────────────

interface FormularioCuentaCobroProps {
  onEnviar: (cc: CuentaCobro) => void;
  usuarioNombre: string;
  usuarioId: string;
}

function FormularioCuentaCobro({ onEnviar, usuarioNombre, usuarioId }: FormularioCuentaCobroProps) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    // numeroCuenta es generado automáticamente por la secuencia de BD
    fechaDocumento: new Date().toISOString().slice(0, 10),
    nombreSolicitante: usuarioNombre,
    cedulaSolicitante: '',
    valorNumerico: '',
    valorLetras: '',
    concepto: '',
    centroCostos: '',
    declaranteRenta: null as boolean | null,
    tomaCostosDeducciones: null as boolean | null,
    tipoCuenta: 'Ahorros' as TipoCuentaBancaria,
    banco: '',
    numeroCuentaBancaria: '',
    titular: '',
  });
  const [firmaSvg, setFirmaSvg] = useState('');
  const [archivos, setArchivos] = useState({
    certificadoBancario: null as File | null,
    seguridadSocial: null as File | null,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});

  const actualizar = (c: string, v: string | boolean) => {
    setForm(p => ({ ...p, [c]: v }));
    if (String(c) in errores) setErrores(p => ({ ...p, [c]: '' }));

    // Auto-calcular valor en letras
    if (c === 'valorNumerico') {
      const num = parseInt((v as string).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) {
        setForm(p => ({ ...p, valorNumerico: v as string, valorLetras: numeroALetras(num) }));
      }
    }
  };

  const validarPaso1 = (): boolean => {
    const e: Record<string, string> = {};
    // numeroCuenta ya no se valida — lo genera automáticamente la BD
    if (!form.nombreSolicitante) e.nombreSolicitante = 'Requerido';
    if (!form.cedulaSolicitante) e.cedulaSolicitante = 'Requerido';
    if (!form.valorNumerico) e.valorNumerico = 'Requerido';
    if (!form.concepto) e.concepto = 'Requerido';
    if (!form.centroCostos) e.centroCostos = 'Requerido';
    if (form.declaranteRenta === null) e.declaranteRenta = 'Debe seleccionar una opción';
    if (form.tomaCostosDeducciones === null) e.tomaCostosDeducciones = 'Debe seleccionar una opción';
    if (!form.banco) e.banco = 'Requerido';
    if (!form.numeroCuentaBancaria) e.numeroCuentaBancaria = 'Requerido';
    if (!form.titular) e.titular = 'Requerido';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const validarPaso2 = (): boolean => {
    const e: Record<string, string> = {};
    if (!archivos.certificadoBancario) e.certificadoBancario = 'Obligatorio';
    if (!archivos.seguridadSocial) e.seguridadSocial = 'Obligatorio';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

const manejarEnvio = async () => {
  if (!validarPaso2()) return;

  // Función interna para convertir File a Base64
  const convertirABase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  try {
    // Convertimos los archivos reales a texto Base64
    const certBase64 = archivos.certificadoBancario ? await convertirABase64(archivos.certificadoBancario) : '';
    const ssBase64 = archivos.seguridadSocial ? await convertirABase64(archivos.seguridadSocial) : '';

    const cc: CuentaCobro = {
      id: `cc-${Date.now()}`,
      numeroCuenta: '', 
      usuarioId,
      nombreSolicitante: form.nombreSolicitante,
      cedulaSolicitante: form.cedulaSolicitante,
      valorNumerico: parseInt(form.valorNumerico.replace(/\D/g, ''), 10) || 0,
      valorLetras: form.valorLetras,
      concepto: form.concepto,
      centroCostos: form.centroCostos,
      declaranteRenta: form.declaranteRenta!,
      tomaCostosDeducciones: form.tomaCostosDeducciones!,
      datosBancarios: {
        tipoCuenta: form.tipoCuenta,
        banco: form.banco,
        numeroCuenta: form.numeroCuentaBancaria, 
        titular: form.titular,
      },
      firmaSvg,
      estado: 'Pendiente',
      fechaDocumento: form.fechaDocumento,
      fechaEnvio: new Date().toISOString(),
      // ¡AQUÍ ESTÁ EL CAMBIO! Enviamos el contenido, no el nombre
      urlCertificadoBancario: certBase64, 
      urlSeguridadSocial: ssBase64,
    };

    onEnviar(cc);
  } catch (error) {
    alert("Error al procesar los archivos. Intenta de nuevo.");
  }
};

  return (
    <div className="space-y-5">
      {/* Indicador de pasos */}
      <div className="flex items-center gap-3 mb-6">
        {[{ n: 1, l: 'Datos del Documento' }, { n: 2, l: 'Gestión Documental' }].map(({ n, l }) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
              style={{
                backgroundColor: paso >= n ? 'var(--cp)' : 'rgba(0,0,0,0.08)',
                color: paso >= n ? 'white' : 'var(--muted-foreground)',
              }}
            >
              {paso > n ? <Check size={12} /> : n}
            </div>
            <span className="text-xs font-medium" style={{ color: paso >= n ? 'var(--cd)' : 'var(--muted-foreground)' }}>
              {l}
            </span>
            {n < 2 && <div className="w-8 h-px mx-1" style={{ backgroundColor: paso > n ? 'var(--cp)' : 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {paso === 1 ? (
        /* ── PASO 1: DATOS DEL DOCUMENTO ── */
        <div className="space-y-5">
          {/* Encabezado del documento */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'rgba(4,40,66,0.04)', border: '1px solid rgba(4,40,66,0.08)' }}
          >
            <div className="text-center mb-4">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--cp)' }}>
                Escala Consciencia &amp; Negocios BIC SAS
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>NIT: 811.007.550-3</p>
              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--muted-foreground)' }}>
                MODELO DE DOCUMENTO EQUIVALENTE A FACTURA (Art. 3 Decreto 522 de Marzo de 2003)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                  Cuenta de Cobro N°
                </label>
                {/* El número se genera automáticamente en el servidor al guardar.
                    Se muestra como solo lectura para no inducir al usuario a error. */}
                <div
                  className="w-full px-3 py-2.5 rounded-lg text-sm border flex items-center gap-2"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(0,0,0,0.02)', color: 'var(--muted-foreground)' }}
                >
                  <span className="font-mono">— Asignado al guardar —</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>
                  <Calendar size={11} className="inline mr-1" />Fecha del documento *
                </label>
                <input
                  type="date"
                  value={form.fechaDocumento}
                  onChange={e => actualizar('fechaDocumento', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                />
              </div>
            </div>
          </div>

          {/* DEBE A */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--cp)' }}>
              DEBE A:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Nombre completo *</label>
                <input
                  value={form.nombreSolicitante}
                  onChange={e => actualizar('nombreSolicitante', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: errores.nombreSolicitante ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                />
                {errores.nombreSolicitante && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.nombreSolicitante}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>CC / NIT *</label>
                <input
                  value={form.cedulaSolicitante}
                  onChange={e => actualizar('cedulaSolicitante', e.target.value)}
                  placeholder="1.234.567.890"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: errores.cedulaSolicitante ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                />
                {errores.cedulaSolicitante && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.cedulaSolicitante}</p>}
              </div>
            </div>
          </div>

          {/* Valor */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--cp)' }}>
              LA SUMA DE:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Valor en números ($ COP) *</label>
                <input
                  value={form.valorNumerico}
                  onChange={e => actualizar('valorNumerico', e.target.value)}
                  placeholder="3.500.000"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: errores.valorNumerico ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                />
                {errores.valorNumerico && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.valorNumerico}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Valor en letras (auto)</label>
                <input
                  readOnly
                  value={form.valorLetras}
                  placeholder="Se genera automáticamente..."
                  className="w-full px-3 py-2.5 rounded-lg text-xs border"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'rgba(0,0,0,0.03)', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Concepto y centro de costos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Por concepto de (Rol) *</label>
              <input
                value={form.concepto}
                onChange={e => actualizar('concepto', e.target.value)}
                placeholder="Diseñador Gráfico"
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: errores.concepto ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
              />
              {errores.concepto && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.concepto}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Centro de Costos *</label>
              <input
                value={form.centroCostos}
                onChange={e => actualizar('centroCostos', e.target.value)}
                placeholder="Marketing y Comunicaciones"
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: errores.centroCostos ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
              />
              {errores.centroCostos && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.centroCostos}</p>}
            </div>
          </div>

          {/* Declaraciones bajo juramento */}
          <div
            className="rounded-xl p-4 space-y-4"
            style={{ backgroundColor: 'rgba(4,40,66,0.04)', border: '1px solid rgba(4,40,66,0.08)' }}
          >
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--cd)', lineHeight: 1.6 }}>
                De conformidad con el artículo 1 del Decreto 1808 de 2019, declaro bajo la gravedad de juramento que soy declarante de renta:
              </p>
              <div className="flex gap-4">
                {([true, false] as const).map(val => (
                  <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => actualizar('declaranteRenta', val)}
                      className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: form.declaranteRenta === val ? 'var(--cp)' : 'var(--border)',
                        backgroundColor: form.declaranteRenta === val ? 'var(--cp)' : 'white',
                      }}
                    >
                      {form.declaranteRenta === val && <Check size={12} style={{ color: 'white' }} />}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--cd)' }}>{val ? 'SÍ' : 'NO'}</span>
                  </label>
                ))}
              </div>
              {errores.declaranteRenta && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.declaranteRenta}</p>}
            </div>

            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--cd)', lineHeight: 1.6 }}>
                De conformidad con el artículo 9 del Decreto 2231 de 2023, manifiesto que tomaré costos o deducciones asociadas a los ingresos:
              </p>
              <div className="flex gap-4">
                {([true, false] as const).map(val => (
                  <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => actualizar('tomaCostosDeducciones', val)}
                      className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: form.tomaCostosDeducciones === val ? 'var(--cp)' : 'var(--border)',
                        backgroundColor: form.tomaCostosDeducciones === val ? 'var(--cp)' : 'white',
                      }}
                    >
                      {form.tomaCostosDeducciones === val && <Check size={12} style={{ color: 'white' }} />}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--cd)' }}>{val ? 'SÍ' : 'NO'}</span>
                  </label>
                ))}
              </div>
              {errores.tomaCostosDeducciones && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.tomaCostosDeducciones}</p>}
            </div>
          </div>

          {/* Datos bancarios */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--cp)' }}>
              FAVOR CONSIGNAR EN:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Tipo de cuenta</label>
                <select
                  value={form.tipoCuenta}
                  onChange={e => actualizar('tipoCuenta', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                >
                  <option value="Ahorros">Cuenta de Ahorros</option>
                  <option value="Corriente">Cuenta Corriente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>Banco *</label>
                <input
                  value={form.banco}
                  onChange={e => actualizar('banco', e.target.value)}
                  placeholder="Ej: Bancolombia"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: errores.banco ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                />
                {errores.banco && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.banco}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>N° de cuenta *</label>
                <input
                  value={form.numeroCuentaBancaria}
                  onChange={e => actualizar('numeroCuentaBancaria', e.target.value)}
                  placeholder="123-456789-01"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: errores.numeroCuentaBancaria ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                />
                {errores.numeroCuentaBancaria && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.numeroCuentaBancaria}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--cd)' }}>A nombre de *</label>
                <input
                  value={form.titular}
                  onChange={e => actualizar('titular', e.target.value)}
                  placeholder="Nombre del titular"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ borderColor: errores.titular ? 'var(--cs)' : 'var(--border)', color: 'var(--cd)', outline: 'none', backgroundColor: 'white' }}
                />
                {errores.titular && <p className="text-xs mt-1" style={{ color: 'var(--cs)' }}>{errores.titular}</p>}
              </div>
            </div>
          </div>

          {/* Firma */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--cp)' }}>FIRMA DIGITAL</p>
            <CanvasFirma
              onFirmar={setFirmaSvg}
              onLimpiar={() => setFirmaSvg('')}
              firmada={!!firmaSvg}
            />
          </div>

          <button
            type="button"
            onClick={() => { if (validarPaso1()) setPaso(2); }}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--cp)', color: 'white' }}
          >
            Continuar a Gestión Documental
          </button>
        </div>
      ) : (
        /* ── PASO 2: DOCUMENTOS ── */
        <div className="space-y-4">
          <div
            className="rounded-xl p-4 mb-4"
            style={{ backgroundColor: 'rgba(0,122,136,0.06)', border: '1px solid rgba(0,122,136,0.15)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--cp)' }}>
              Cuenta de Cobro — {form.nombreSolicitante}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Valor: {formatearMoneda(parseInt(form.valorNumerico.replace(/\D/g, '') || '0', 10))}
            </p>
          </div>

          <div
            className="rounded-xl p-3 mb-2 flex items-start gap-2"
            style={{ backgroundColor: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
            <p className="text-xs" style={{ color: '#92400e' }}>
              Los dos documentos son <strong>obligatorios</strong>. El sistema no permitirá el envío sin ellos.
            </p>
          </div>

          <ZonaCarga
            label="Planilla de Seguridad Social"
            descripcion="Planilla del mes vigente — PDF"
            archivo={archivos.seguridadSocial}
            onSeleccionar={f => setArchivos(p => ({ ...p, seguridadSocial: f }))}
            obligatorio
          />
          {errores.seguridadSocial && <p className="text-xs -mt-2" style={{ color: 'var(--cs)' }}>{errores.seguridadSocial}</p>}

          <ZonaCarga
            label="Certificado de Cuenta"
            descripcion="Carta bancaria o certificado de cuenta vigente — PDF"
            archivo={archivos.certificadoBancario}
            onSeleccionar={f => setArchivos(p => ({ ...p, certificadoBancario: f }))}
            obligatorio
          />
          {errores.certificadoBancario && <p className="text-xs -mt-2" style={{ color: 'var(--cs)' }}>{errores.certificadoBancario}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPaso(1)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              Atrás
            </button>
            <button
              type="button"
              onClick={manejarEnvio}
              disabled={!archivos.certificadoBancario || !archivos.seguridadSocial}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                backgroundColor: archivos.certificadoBancario && archivos.seguridadSocial
                  ? 'var(--cp)' : '#9cabb3',
                color: 'white',
                cursor: archivos.certificadoBancario && archivos.seguridadSocial ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={14} /> Enviar Cuenta de Cobro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLERO CONTABLE
// ─────────────────────────────────────────────────────────────────────────────

interface ModalAccionContableProps {
  cuenta: CuentaCobro;
  accion: 'autorizar' | 'rechazar';
  onConfirmar: (cuentaId: string, accion: 'autorizar' | 'rechazar', motivo?: string, comprobante?: File) => void;
  onCerrar: () => void;
}

function ModalAccionContable({ cuenta, accion, onConfirmar, onCerrar }: ModalAccionContableProps) {
  const { usuario } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const esContableRole = usuario?.rol === 'Contable';
  const tituloAutorizar = esContableRole ? 'Enviar a Revisión CEO' : 'Autorizar Pago';

  return (
    <div className="modal-fondo" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl p-6 animar-entrada"
        style={{ backgroundColor: 'white', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--cd)' }}>
            {accion === 'autorizar' ? tituloAutorizar : 'Rechazar Cuenta'}
          </h2>
          <button onClick={onCerrar}><X size={18} style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>

        <div
          className="rounded-xl p-3 mb-4"
          style={{ backgroundColor: 'rgba(4,40,66,0.04)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--cd)' }}>Cuenta N° {cuenta.numeroCuenta}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {cuenta.nombreSolicitante} — {formatearMoneda(cuenta.valorNumerico)}
          </p>
        </div>

        {accion === 'autorizar' ? (
          <div className="space-y-3">
            {esContableRole ? (
              <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <p className="text-sm" style={{ color: '#0369a1' }}>
                  Esta cuenta quedará en estado <strong>En revisión</strong> y el CEO recibirá una notificación para aprobar o rechazar.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm" style={{ color: 'var(--cd)' }}>
                  Cargue el comprobante de pago para confirmar la autorización:
                </p>
                <ZonaCarga
                  label="Comprobante de Pago"
                  descripcion="PDF del comprobante bancario"
                  archivo={comprobante}
                  onSeleccionar={setComprobante}
                  obligatorio
                />
              </>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cd)' }}>
              Motivo del rechazo *
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={4}
              placeholder="Ej: La planilla de seguridad social está vencida. Por favor adjunte la del mes actual."
              className="w-full px-3 py-2.5 rounded-lg text-sm border resize-none"
              style={{ borderColor: 'var(--border)', color: 'var(--cd)', outline: 'none' }}
            />
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onCerrar}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(cuenta.id, accion, motivo || undefined, comprobante || undefined)}
            disabled={accion === 'rechazar' && !motivo.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              backgroundColor: accion === 'autorizar' ? 'var(--cp)' : 'var(--cs)',
              color: 'white',
            }}
          >
            {accion === 'autorizar'
              ? <><CheckCircle size={14} /> {esContableRole ? 'Enviar a revisión' : 'Autorizar'}</>
              : <><XCircle size={14} /> Rechazar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloCobros() {
  const { usuario } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaCobro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [vistaActiva, setVistaActiva] = useState<'formulario' | 'tablero'>(() =>
    esContador(usuario?.rol ?? 'Personal_base') ? 'tablero' : 'formulario'
  );
  const [filtroEstado, setFiltroEstado] = useState<EstadoCuentaCobro | 'Todos'>('Todos');
  const [modalAccion, setModalAccion] = useState<{ cuenta: CuentaCobro; accion: 'autorizar' | 'rechazar' } | null>(null);
  const [envioExitoso, setEnvioExitoso] = useState(false);

  // Calcular antes del return condicional para no violar reglas de hooks
  const esContadorOAdmin = esContador(usuario?.rol ?? 'Personal_base');

  /** Carga inicial desde PostgreSQL según el rol del usuario. */
  const cargarCuentas = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setErrorCarga('');
    try {
      const res = esContadorOAdmin
        ? await obtenerTodasLasCuentas()
        : await obtenerCuentasDeUsuario(usuario.id);
      if (res.ok && res.datos) {
        setCuentas(res.datos);
      } else {
        setErrorCarga(res.error ?? 'Error al cargar las cuentas.');
      }
    } finally {
      setCargando(false);
    }
  }, [esContadorOAdmin, usuario]);

  useEffect(() => { cargarCuentas(); }, [cargarCuentas]);

  const cuentasFiltradas = useMemo(() => {
    let lista = filtroEstado === 'Todos'
      ? cuentas
      : cuentas.filter(c => c.estado === filtroEstado);

    return lista.sort((a, b) =>
      new Date(b.fechaEnvio ?? 0).getTime() - new Date(a.fechaEnvio ?? 0).getTime()
    );
  }, [cuentas, filtroEstado]);

  /** Envía una nueva cuenta a PostgreSQL. */
  const registrarCuenta = useCallback(async (cc: CuentaCobro) => {
    if (!usuario) return;
    setGuardando(true);
    try {
      // ─── BUSCA ESTA PARTE EN TU CÓDIGO Y AÑADE LA LÍNEA RESALTADA ───

const res = await crearCuentaCobro({
  numeroCuenta: cc.numeroCuenta, // <--- AÑADE ESTA LÍNEA AQUÍ
  usuarioId: cc.usuarioId,
  nombreSolicitante: cc.nombreSolicitante,
  cedulaSolicitante: cc.cedulaSolicitante,
  valorNumerico: cc.valorNumerico,
  valorLetras: cc.valorLetras,
  concepto: cc.concepto,
  centroCostos: cc.centroCostos,
  declaranteRenta: cc.declaranteRenta,
  tomaCostosDeducciones: cc.tomaCostosDeducciones,
  banco: cc.datosBancarios.banco,
  tipoCuenta: cc.datosBancarios.tipoCuenta,
  numeroCuentaBancaria: cc.datosBancarios.numeroCuenta,
  titular: cc.datosBancarios.titular,
  firmaSvg: cc.firmaSvg,
  fechaDocumento: cc.fechaDocumento,
  urlCertificadoBancario: cc.urlCertificadoBancario,
  urlSeguridadSocial: cc.urlSeguridadSocial,
});
      if (res.ok) {
        setEnvioExitoso(true);
        await cargarCuentas();
        setTimeout(() => { setEnvioExitoso(false); setVistaActiva('tablero'); }, 2000);
      } else {
        setErrorCarga(res.error ?? 'Error al guardar la cuenta.');
      }
    } finally {
      setGuardando(false);
    }
  }, [usuario, cargarCuentas]);

  /** Autoriza o rechaza una cuenta en PostgreSQL.
   * Flujo en cadena:
   *   - Contable: Pendiente → En revisión
   *   - CEO / TI:  Pendiente | En revisión → Autorizado
   *   - Cualquiera con permiso: → Rechazado
   */
  const procesarAccion = useCallback(async (
    cuentaId: string,
    accion: 'autorizar' | 'rechazar',
    motivo?: string,
    _comprobante?: File,
  ) => {
    if (!usuario) return;
    setGuardando(true);
    try {
      let nuevoEstado: EstadoCuentaCobro;
      if (accion === 'rechazar') {
        nuevoEstado = 'Rechazado';
      } else if (usuario.rol === 'Contable') {
        // Contable solo puede pasar a "En revisión"
        nuevoEstado = 'En revisión';
      } else {
        // CEO / TI autorizan directamente
        nuevoEstado = 'Autorizado';
      }
      const res = await actualizarEstadoCuenta({
        id:              cuentaId,
        estado:          nuevoEstado,
        autorizadoPorId: usuario.id,
        motivoRechazo:   motivo,
      });
      if (res.ok) {
        await cargarCuentas();
      } else {
        setErrorCarga(res.error ?? 'Error al procesar la acción.');
      }
    } finally {
      setGuardando(false);
      setModalAccion(null);
    }
  }, [usuario, cargarCuentas]);

  const ESTADOS: (EstadoCuentaCobro | 'Todos')[] = ['Todos', 'Pendiente', 'En revisión', 'Autorizado', 'Pagada', 'Rechazado'];

  /**
   * Marca una cuenta como "Pagada".
   * Solo disponible para CEO y Contable, y únicamente sobre cuentas 'Autorizado'.
   * La validación de rol se realiza TAMBIÉN en el servidor (doble capa).
   */
  const ejecutarMarcarPagada = useCallback(async (cuentaId: string) => {
    if (!usuario) return;
    // Guardia de rol en el cliente — el servidor también lo valida
    if (usuario.rol !== 'CEO' && usuario.rol !== 'Contable') return;
    setGuardando(true);
    try {
      const res = await marcarComoPagada({
        cuentaId,
        pagadoPorId: usuario.id,
        rolUsuario:  usuario.rol,
      });
      if (res.ok) {
        await cargarCuentas();
      } else {
        setErrorCarga(res.error ?? 'No se pudo marcar como pagada.');
      }
    } finally {
      setGuardando(false);
    }
  }, [usuario, cargarCuentas]);

  if (!usuario) return null;

  if (cargando) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Cargando cuentas de cobro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>Cobros y Pagos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Flujo de cuentas de cobro y aprobación contable
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={cargarCuentas}
            disabled={guardando}
            className="p-2 rounded-xl border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            title="Actualizar"
          >
            <AlertCircle size={16} />
          </button>
          {(['formulario', 'tablero'] as const).map(v => (
            <button
              key={v}
              onClick={() => setVistaActiva(v)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: vistaActiva === v ? 'var(--cp)' : 'white',
                color: vistaActiva === v ? 'white' : 'var(--muted-foreground)',
                border: `1px solid ${vistaActiva === v ? 'var(--cp)' : 'var(--border)'}`,
              }}
            >
              {v === 'formulario' ? 'Nueva Cuenta' : 'Tablero'}
            </button>
          ))}
        </div>
      </div>

      {/* Banner de error */}
      {errorCarga && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(186,86,40,0.1)', border: '1px solid rgba(186,86,40,0.25)' }}>
          <AlertCircle size={16} style={{ color: 'var(--cs)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--cs)' }}>{errorCarga}</p>
        </div>
      )}

      {/* Alerta de envío exitoso */}
      {envioExitoso && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl animar-entrada"
          style={{ backgroundColor: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.25)' }}
        >
          <CheckCircle size={18} style={{ color: '#059669' }} />
          <p className="text-sm font-semibold" style={{ color: '#065f46' }}>
            Cuenta de cobro enviada correctamente. El contador recibirá una notificación.
          </p>
        </div>
      )}

      {vistaActiva === 'formulario' ? (
        <div
          className="rounded-2xl p-6 max-w-2xl mx-auto"
          style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,122,136,0.1)' }}>
              <FileText size={20} style={{ color: 'var(--cp)' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--cd)' }}>Diligenciar Cuenta de Cobro</h2>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Escala Consciencia &amp; Negocios BIC SAS — NIT: 811.007.550-3
              </p>
            </div>
          </div>
          <FormularioCuentaCobro
            onEnviar={registrarCuenta}
            usuarioNombre={usuario.nombreCompleto}
            usuarioId={usuario.id}
          />
        </div>
      ) : (
        /* ── TABLERO ── */
        <div className="space-y-4">
          {/* Filtros por estado */}
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map(e => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: filtroEstado === e ? 'var(--cp)' : 'white',
                  color: filtroEstado === e ? 'white' : 'var(--muted-foreground)',
                  border: `1px solid ${filtroEstado === e ? 'var(--cp)' : 'var(--border)'}`,
                }}
              >
                {e} {e !== 'Todos' && `(${cuentas.filter(c => c.estado === e && (esContadorOAdmin || c.usuarioId === usuario.id)).length})`}
              </button>
            ))}
          </div>

          {/* Tabla */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'rgba(4,40,66,0.04)', borderBottom: '1px solid var(--border)' }}>
                  {['N°', 'Solicitante', 'Concepto / Centro de Costos', 'Valor', 'Fecha Envío', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuentasFiltradas.map(cc => (
                  <tr key={cc.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>#{cc.numeroCuenta}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-xs" style={{ color: 'var(--cd)' }}>{cc.nombreSolicitante}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>CC {cc.cedulaSolicitante}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium" style={{ color: 'var(--cd)' }}>{cc.concepto}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{cc.centroCostos}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-xs whitespace-nowrap" style={{ color: 'var(--cp)' }}>
                      {formatearMoneda(cc.valorNumerico)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {cc.fechaEnvio ? formatearFechaCorta(cc.fechaEnvio) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`insignia-estado ${claseEstadoCuenta(cc.estado)}`}>
                        {cc.estado}
                      </span>
                      {cc.motivoRechazo && (
                        <p className="text-xs mt-1 max-w-[180px]" style={{ color: 'var(--cs)' }} title={cc.motivoRechazo}>
                          {cc.motivoRechazo.slice(0, 50)}…
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
  <div className="flex items-center gap-1.5">
    {/* Ver adjuntos: Visible para todos */}
    {(cc.urlCertificadoBancario || cc.urlSeguridadSocial) && (
       <span className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(0,122,136,0.08)', color: 'var(--cp)' }}>
         <Eye size={13} />
       </span>
    )}

    {/* ACCIONES DE PODER: Solo CEO y Contable */}
    {(usuario?.rol === 'CEO' || usuario?.rol === 'Contable') && (
      <>
        {/* El Contable solo ve el botón si está Pendiente */}
        {usuario.rol === 'Contable' && cc.estado === 'Pendiente' && (
          <button onClick={() => setModalAccion({ cuenta: cc, accion: 'autorizar' })} className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(14,165,233,0.1)', color: '#0284c7' }}>
            <MessageSquare size={13} />
          </button>
        )}

        {/* El CEO ve el botón en Pendiente o En Revisión */}
        {usuario.rol === 'CEO' && (cc.estado === 'Pendiente' || cc.estado === 'En revisión') && (
          <button onClick={() => setModalAccion({ cuenta: cc, accion: 'autorizar' })} className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(5,150,105,0.1)', color: '#059669' }}>
            <CheckCircle size={13} />
          </button>
        )}

        {/* Ambos pueden rechazar */}
        {(cc.estado === 'Pendiente' || cc.estado === 'En revisión') && (
          <button onClick={() => setModalAccion({ cuenta: cc, accion: 'rechazar' })} className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(186,86,40,0.1)', color: 'var(--cs)' }}>
            <XCircle size={13} />
          </button>
        )}
      </>
    )}
  </div>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cuentasFiltradas.length === 0 && (
              <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay cuentas de cobro con el filtro seleccionado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de acción contable */}
      {modalAccion && (
        <ModalAccionContable
          cuenta={modalAccion.cuenta}
          accion={modalAccion.accion}
          onConfirmar={procesarAccion}
          onCerrar={() => setModalAccion(null)}
        />
      )}
    </div>
  );
}
