'use server';

/**
 * @fileoverview Server Actions CRUD para la tabla `cuentas_cobro`.
 * Gestiona el ciclo de vida completo: Pendiente → En revisión → Autorizado | Rechazado.
 */

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import type { CuentaCobro, EstadoCuentaCobro, TipoCuentaBancaria } from '@/lib/tipos';
import { crearNotificacion } from '@/lib/actions/notificaciones-actions';
import jsPDF from 'jspdf';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS: DOCUMENTOS PERSONAL
// ─────────────────────────────────────────────────────────────────────────────

export type TipoDocumentoPersonal = 'seg_social' | 'cert_bancario' | 'cuenta_cobro_pdf';

function _generarNombreArchivo(
  nombreSolicitante: string,
  tipo: TipoDocumentoPersonal,
  fecha: string,
): string {
  const nombre = nombreSolicitante
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  const mapa = { seg_social: 'SegSocial', cert_bancario: 'CertBancario', cuenta_cobro_pdf: 'CuentaCobro' };
  return `${nombre}_${mapa[tipo]}_${fecha}`;
}

interface _DatosPDF {
  numeroCuenta: string; nombreSolicitante: string; cedulaSolicitante: string;
  valorNumerico: number | string; valorLetras: string; concepto: string;
  centroCostos: string; banco: string; tipoCuenta: string;
  numeroCuentaBancaria: string; titular: string; fechaDocumento: string;
  declaranteRenta: boolean;
}

function _sanitizarTexto(valor: string | number | boolean | null | undefined): string {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _generarPDFBase64(d: _DatosPDF): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margenX = 15;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(4, 40, 66);
  doc.text(`CUENTA DE COBRO No. ${_sanitizarTexto(d.numeroCuenta)}`, margenX, y);

  y += 8;
  doc.setDrawColor(0, 122, 136);
  doc.setLineWidth(0.8);
  doc.line(margenX, y, 195, y);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);

  const filas: Array<[string, string]> = [
    ['Nombre', _sanitizarTexto(d.nombreSolicitante)],
    ['Cédula', _sanitizarTexto(d.cedulaSolicitante)],
    ['Fecha', _sanitizarTexto(d.fechaDocumento)],
    ['Concepto', _sanitizarTexto(d.concepto)],
    ['Centro de Costos', _sanitizarTexto(d.centroCostos)],
    ['Valor', `$${Number(d.valorNumerico).toLocaleString('es-CO')}`],
    ['Son', _sanitizarTexto(d.valorLetras)],
    ['Banco', _sanitizarTexto(d.banco)],
    ['Tipo Cuenta', _sanitizarTexto(d.tipoCuenta)],
    ['No. Cuenta', _sanitizarTexto(d.numeroCuentaBancaria)],
    ['Titular', _sanitizarTexto(d.titular)],
    ['Declarante de Renta', d.declaranteRenta ? 'Sí' : 'No'],
  ];

  filas.forEach(([label, value]) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margenX, y);
    doc.setFont('helvetica', 'normal');
    const texto = doc.splitTextToSize(value, 130);
    doc.text(texto, 62, y);
    y += Math.max(7, texto.length * 5);
  });

  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(108, 117, 125);
  doc.text(`Generado por Escala ADN - ${new Date().toLocaleString('es-CO')}`, margenX, y);

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer).toString('base64');
}

export interface DocumentoPersonal {
  id:               string;
  usuarioId:        string;
  nombreUsuario:    string;
  cuentaCobroId:    string | null;
  nombreArchivo:    string;
  tipoDocumento:    TipoDocumentoPersonal;
  contenidoBase64:  string;
  mimeType:         string;
  creadoEn:         string;
}

interface FilaDocumento {
  id:                string;
  usuario_id:        string;
  nombre_usuario:    string;
  cuenta_cobro_id:   string | null;
  nombre_archivo:    string;
  tipo_documento:    TipoDocumentoPersonal;
  contenido_base64:  string; // <--- QUITAR EL GUION BAJO AQUÍ
  mime_type:         string;
  creado_en:         Date | string;
}

function mapearDocumento(f: FilaDocumento): DocumentoPersonal {
  return {
    id:               f.id,
    usuarioId:        f.usuario_id,
    nombreUsuario:    f.nombre_usuario,
    cuentaCobroId:    f.cuenta_cobro_id ?? null,
    nombreArchivo:    f.nombre_archivo,
    tipoDocumento:    f.tipo_documento, 
    contenidoBase64:  f.contenido_base64, // <--- QUITAR EL GUION BAJO AQUÍ TAMBIÉN
    mimeType:         f.mime_type,
    creadoEn:         f.creado_en instanceof Date 
                        ? f.creado_en.toISOString() 
                        : String(f.creado_en),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCIONES DE DOCUMENTOS
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarDocumento(datos: {
  usuarioId: string; cuentaCobroId: string; nombreArchivo: string;
  tipoDocumento: TipoDocumentoPersonal; contenidoBase64: string; mimeType: string;
}): Promise<void> {
  await query(
    `INSERT INTO documentos_personal
        (usuario_id, cuenta_cobro_id, nombre_archivo, tipo_documento, contenido_base64, mime_type)
     VALUES ($1,$2,$3,$4,$5,$6)`, // CORREGIDO: contenido_base64
    [datos.usuarioId, datos.cuentaCobroId, datos.nombreArchivo,
     datos.tipoDocumento, datos.contenidoBase64, datos.mimeType],
  );
}

export async function obtenerDocumentosDeUsuario(usuarioId: string): Promise<DocumentoPersonal[]> {
  const filas = await query<FilaDocumento>(
    `SELECT dp.id, dp.usuario_id,
            u.nombre_completo AS nombre_usuario,
            dp.cuenta_cobro_id, dp.nombre_archivo,
            dp.tipo_documento, dp.contenido_base64, dp.mime_type, dp.creado_en
     FROM documentos_personal dp
     JOIN usuarios u ON u.id = dp.usuario_id
     WHERE dp.usuario_id = $1 AND dp.borrado = FALSE
     ORDER BY dp.creado_en DESC`, // CORREGIDO: contenido_base64
    [usuarioId],
  );
  return filas.map(mapearDocumento);
}

export async function obtenerTodosLosDocumentos(): Promise<DocumentoPersonal[]> {
  const filas = await query<FilaDocumento>(
    `SELECT dp.id, dp.usuario_id, u.nombre_completo AS nombre_usuario, 
       dp.cuenta_cobro_id, dp.nombre_archivo, dp.tipo_documento, 
       dp.contenido_base64, dp.mime_type, dp.creado_en
     FROM documentos_personal dp
     JOIN usuarios u ON u.id = dp.usuario_id
     WHERE dp.borrado = FALSE
     ORDER BY u.nombre_completo, dp.creado_en DESC`, // CORREGIDO: contenido_base64
  );
  return filas.map(mapearDocumento);
}

export async function eliminarDocumento(
  documentoId: string,
  eliminadoPorId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await query(
      `UPDATE documentos_personal
       SET borrado = TRUE, borrado_por = $1, borrado_en = NOW()
       WHERE id = $2`,
      [eliminadoPorId, documentoId],
    );
    return { ok: true };
  } catch (e) {
    console.error('[Documentos] eliminarDocumento:', e);
    return { ok: false, error: 'No se pudo eliminar el documento.' };
  }
}

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

export interface ResultadoConDatos<T> extends ResultadoAccion {
  datos?: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: mapear fila de BD → tipo CuentaCobro
// ─────────────────────────────────────────────────────────────────────────────

interface FilaCuentaCobro {
  id: string;
  numero_cuenta: string;
  usuario_id: string;
  nombre_solicitante: string;
  cedula_solicitante: string;
  valor_numerico: string;
  valor_letras: string;
  concepto: string;
  centro_costos: string;
  declarante_renta: boolean;
  toma_costos_deducciones: boolean;
  banco: string;
  tipo_cuenta_bancaria: string;
  numero_cuenta_bancaria: string;
  titular_cuenta: string;
  firma_base64: string | null;
  fecha_documento: string;
  url_cuenta_cobro_drive: string | null;
  url_cert_bancario_drive: string | null;
  url_seg_social_drive: string | null;
  url_comprobante_pago_drive: string | null;
  estado: string;
  motivo_rechazo: string | null;
  fecha_envio: string | null;
  fecha_autorizacion: string | null;
  autorizado_por_nombre: string | null;
}

function mapearCuentaCobro(f: FilaCuentaCobro): CuentaCobro {
  return {
    id:                      f.id,
    numeroCuenta:            f.numero_cuenta,
    usuarioId:               f.usuario_id,
    nombreSolicitante:       f.nombre_solicitante,
    cedulaSolicitante:       f.cedula_solicitante,
    valorNumerico:           parseInt(f.valor_numerico, 10),
    valorLetras:             f.valor_letras,
    concepto:                f.concepto,
    centroCostos:            f.centro_costos,
    declaranteRenta:         f.declarante_renta,
    tomaCostosDeducciones:   f.toma_costos_deducciones,
    datosBancarios: {
      tipoCuenta:    f.tipo_cuenta_bancaria as TipoCuentaBancaria,
      banco:         f.banco,
      numeroCuenta:  f.numero_cuenta_bancaria,
      titular:       f.titular_cuenta,
    },
    firmaSvg:                f.firma_base64 ?? undefined,
    fechaDocumento: f.fecha_documento 
      ? new Date(f.fecha_documento).toISOString().slice(0, 10) 
      : '',
    urlCertificadoBancario:  f.url_cert_bancario_drive ?? undefined,
    urlSeguridadSocial:      f.url_seg_social_drive ?? undefined,
    urlComprobantePago:      f.url_comprobante_pago_drive ?? undefined,
    estado:                  f.estado as EstadoCuentaCobro,
    motivoRechazo:           f.motivo_rechazo ?? undefined,
    fechaEnvio: f.fecha_envio 
      ? new Date(f.fecha_envio).toISOString() 
      : undefined,
    fechaAutorizacion: f.fecha_autorizacion 
      ? new Date(f.fecha_autorizacion).toISOString() 
      : undefined,
    autorizadoPor:           f.autorizado_por_nombre ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

const SELECT_CUENTAS = `
  SELECT
    cc.id, cc.numero_cuenta, cc.usuario_id, cc.nombre_solicitante,
    cc.cedula_solicitante, cc.valor_numerico, cc.valor_letras, cc.concepto,
    cc.centro_costos, cc.declarante_renta, cc.toma_costos_deducciones,
    cc.banco, cc.tipo_cuenta_bancaria, cc.numero_cuenta_bancaria, cc.titular_cuenta,
    cc.firma_base64, cc.fecha_documento,
    cc.url_cuenta_cobro_drive, cc.url_cert_bancario_drive,
    cc.url_seg_social_drive, cc.url_comprobante_pago_drive,
    cc.estado, cc.motivo_rechazo,
    cc.fecha_envio, cc.fecha_autorizacion,
    u.nombre_completo AS autorizado_por_nombre
  FROM cuentas_cobro cc
  LEFT JOIN usuarios u ON u.id = cc.autorizado_por
`;

export async function obtenerTodasLasCuentas(): Promise<ResultadoConDatos<CuentaCobro[]>> {
  try {
    const filas = await query<FilaCuentaCobro>(
      `${SELECT_CUENTAS} ORDER BY cc.fecha_envio DESC, cc.creado_en DESC`,
    );
    return { ok: true, datos: filas.map(mapearCuentaCobro) };
  } catch (error) {
    console.error('[Cobros] obtenerTodasLasCuentas:', error);
    return { ok: false, error: 'No se pudo obtener las cuentas de cobro.' };
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerCuentasDeUsuario(
  usuarioId: string,
): Promise<ResultadoConDatos<CuentaCobro[]>> {
  if (!UUID_REGEX.test(usuarioId)) {
    return { ok: true, datos: [] };
  }
  try {
    const filas = await query<FilaCuentaCobro>(
      `${SELECT_CUENTAS} WHERE cc.usuario_id = $1 ORDER BY cc.fecha_envio DESC, cc.creado_en DESC`,
      [usuarioId],
    );
    return { ok: true, datos: filas.map(mapearCuentaCobro) };
  } catch (error) {
    console.error('[Cobros] obtenerCuentasDeUsuario:', error);
    return { ok: false, error: 'No se pudo obtener tus cuentas de cobro.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosCrearCuentaCobro {
  numeroCuenta:          string;
  usuarioId:             string;
  nombreSolicitante:     string;
  cedulaSolicitante:     string;
  valorNumerico:         number;
  valorLetras:           string;
  concepto:              string;
  centroCostos:          string;
  declaranteRenta:       boolean;
  tomaCostosDeducciones: boolean;
  banco:                 string;
  tipoCuenta:            TipoCuentaBancaria;
  numeroCuentaBancaria:  string;
  titular:               string;
  firmaSvg?:             string;
  fechaDocumento:        string;
  urlCertificadoBancario?: string;
  urlSeguridadSocial?:   string;
}

export async function crearCuentaCobro(
  datos: DatosCrearCuentaCobro,
): Promise<ResultadoConDatos<CuentaCobro>> {
  const esUUID = UUID_REGEX.test(datos.usuarioId);
  if (!esUUID) {
    return { ok: false, error: 'Sesión inválida.' };
  }

  const existeUsuario = await query<{ id: string }>(
    'SELECT id FROM usuarios WHERE id = $1 AND activo = TRUE LIMIT 1',
    [datos.usuarioId],
  ).catch(() => []);

  if (existeUsuario.length === 0) {
    return { ok: false, error: 'Usuario no activo.' };
  }

  try {
    const [{ numero_cuenta_generado }] = await query<{ numero_cuenta_generado: number }>(
      `SELECT nextval('seq_numero_cuenta')::integer AS numero_cuenta_generado`,
    );
    const numeroCuentaFinal = String(numero_cuenta_generado).padStart(4, '0');

    const filas = await query<{ id: string; creado_en: string }>(
      `INSERT INTO cuentas_cobro (
          numero_cuenta, usuario_id, nombre_solicitante, cedula_solicitante,
          valor_numerico, valor_letras, concepto, centro_costos,
          declarante_renta, toma_costos_deducciones,
          banco, tipo_cuenta_bancaria, numero_cuenta_bancaria, titular_cuenta,
          firma_base64, fecha_documento,
          url_cert_bancario_drive, url_seg_social_drive,
          estado, fecha_envio
       ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
          'Pendiente', NOW()
       )
       RETURNING id, creado_en`,
      [
        numeroCuentaFinal, datos.usuarioId, datos.nombreSolicitante,
        datos.cedulaSolicitante, datos.valorNumerico, datos.valorLetras,
        datos.concepto, datos.centroCostos,
        datos.declaranteRenta, datos.tomaCostosDeducciones,
        datos.banco, datos.tipoCuenta, datos.numeroCuentaBancaria, datos.titular,
        datos.firmaSvg ?? null, datos.fechaDocumento,
        datos.urlCertificadoBancario ?? null, datos.urlSeguridadSocial ?? null,
      ],
    );

    const nueva: CuentaCobro = {
      id:                     filas[0].id,
      numeroCuenta:           numeroCuentaFinal,
      usuarioId:              datos.usuarioId,
      nombreSolicitante:      datos.nombreSolicitante,
      cedulaSolicitante:      datos.cedulaSolicitante,
      valorNumerico:          datos.valorNumerico,
      valorLetras:            datos.valorLetras,
      concepto:               datos.concepto,
      centroCostos:           datos.centroCostos,
      declaranteRenta:        datos.declaranteRenta,
      tomaCostosDeducciones:  datos.tomaCostosDeducciones,
      datosBancarios: {
        tipoCuenta:   datos.tipoCuenta,
        banco:        datos.banco,
        numeroCuenta: datos.numeroCuentaBancaria,
        titular:      datos.titular,
      },
      firmaSvg:               datos.firmaSvg,
      fechaDocumento:         datos.fechaDocumento,
      urlCertificadoBancario: datos.urlCertificadoBancario,
      urlSeguridadSocial:     datos.urlSeguridadSocial,
      estado:                 'Pendiente',
      fechaEnvio:             new Date().toISOString(),
    };

    const cuentaId  = filas[0].id;
    const fechaHoy  = new Date().toISOString().slice(0, 10);
    const nombreSol = datos.nombreSolicitante;

    const tareasDocumentos: Promise<unknown>[] = [];

    if (datos.urlSeguridadSocial) {
      const esDataPdf = datos.urlSeguridadSocial.startsWith('data:application/pdf;base64,');
      const contenidoNormalizado = datos.urlSeguridadSocial.startsWith('data:')
        ? datos.urlSeguridadSocial.slice(datos.urlSeguridadSocial.indexOf(',') + 1)
        : datos.urlSeguridadSocial;

      const base64Limpio = contenidoNormalizado.replace(/[\r\n\s]/g, '');
      const bin = Buffer.from(base64Limpio, 'base64');
      const esPdfReal = bin.length >= 4 && bin[0] === 0x25 && bin[1] === 0x50 && bin[2] === 0x44 && bin[3] === 0x46;

      if (esDataPdf || esPdfReal) {
        tareasDocumentos.push(
          guardarDocumento({
            usuarioId:       datos.usuarioId,
            cuentaCobroId:   cuentaId,
            nombreArchivo:   _generarNombreArchivo(nombreSol, 'seg_social', fechaHoy),
            tipoDocumento:   'seg_social',
            contenidoBase64: base64Limpio,
            mimeType:         'application/pdf',
          }).catch(e => console.error('[Cobros] guardar seg_social:', e)),
        );
      } else {
        console.warn('[Cobros] seg_social omitido: contenido no PDF válido');
      }
    }

    if (datos.urlCertificadoBancario) {
      const esDataPdf = datos.urlCertificadoBancario.startsWith('data:application/pdf;base64,');
      const contenidoNormalizado = datos.urlCertificadoBancario.startsWith('data:')
        ? datos.urlCertificadoBancario.slice(datos.urlCertificadoBancario.indexOf(',') + 1)
        : datos.urlCertificadoBancario;

      const base64Limpio = contenidoNormalizado.replace(/[\r\n\s]/g, '');
      const bin = Buffer.from(base64Limpio, 'base64');
      const esPdfReal = bin.length >= 4 && bin[0] === 0x25 && bin[1] === 0x50 && bin[2] === 0x44 && bin[3] === 0x46;

      if (esDataPdf || esPdfReal) {
        tareasDocumentos.push(
          guardarDocumento({
            usuarioId:       datos.usuarioId,
            cuentaCobroId:   cuentaId,
            nombreArchivo:   _generarNombreArchivo(nombreSol, 'cert_bancario', fechaHoy),
            tipoDocumento:   'cert_bancario',
            contenidoBase64: base64Limpio,
            mimeType:         'application/pdf',
          }).catch(e => console.error('[Cobros] guardar cert_bancario:', e)),
        );
      } else {
        console.warn('[Cobros] cert_bancario omitido: contenido no PDF válido');
      }
    }

    const pdfBase64 = _generarPDFBase64({
      numeroCuenta:         numeroCuentaFinal,
      nombreSolicitante:     datos.nombreSolicitante,
      cedulaSolicitante:     datos.cedulaSolicitante,
      valorNumerico:         datos.valorNumerico,
      valorLetras:           datos.valorLetras,
      concepto:              datos.concepto,
      centroCostos:          datos.centroCostos,
      banco:                 datos.banco,
      tipoCuenta:            datos.tipoCuenta,
      numeroCuentaBancaria: datos.numeroCuentaBancaria,
      titular:               datos.titular,
      fechaDocumento:       datos.fechaDocumento,
      declaranteRenta:       datos.declaranteRenta,
    });

    tareasDocumentos.push(
      guardarDocumento({
        usuarioId:       datos.usuarioId,
        cuentaCobroId:   cuentaId,
        nombreArchivo:   _generarNombreArchivo(nombreSol, 'cuenta_cobro_pdf', fechaHoy),
        tipoDocumento:   'cuenta_cobro_pdf',
        contenidoBase64: pdfBase64,
        mimeType:         'application/pdf',
      }).catch(e => console.error('[Cobros] guardar cuenta_cobro_pdf:', e)),
    );

    await Promise.all(tareasDocumentos);
    revalidatePath('/');
    return { ok: true, datos: nueva };
  } catch (error: unknown) {
    console.error('[Cobros] crearCuentaCobro:', error);
    return { ok: false, error: 'No se pudo crear la cuenta de cobro.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ESTADO
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosActualizarEstado {
  id:               string;
  estado:           EstadoCuentaCobro;
  motivoRechazo?:   string;
  autorizadoPorId?: string; 
}

export async function actualizarEstadoCuenta(
  datos: DatosActualizarEstado,
): Promise<ResultadoAccion> {
  try {
    const [verificarUsuario] = await query<{ rol_nombre: string }>(
      `SELECT r.nombre AS rol_nombre 
       FROM usuarios u 
       JOIN roles r ON r.id = u.rol_id 
       WHERE u.id = $1`,
      [datos.autorizadoPorId]
    ).catch(() => []);

    const rolLimpio = verificarUsuario?.rol_nombre?.trim().toUpperCase();
    const rolesAutorizados = ['CEO', 'CONTABLE'];

    if (!rolLimpio || !rolesAutorizados.includes(rolLimpio)) {
      console.error(`[SEGURIDAD] Denegado. ID: ${datos.autorizadoPorId}, Rol detectado: "${verificarUsuario?.rol_nombre}"`);
      return { 
        ok: false, 
        error: 'ACCESO DENEGADO: No tienes permisos para cambiar el estado de las cuentas de cobro.' 
      };
    }

    const [cuenta] = await query<{ usuario_id: string; numero_cuenta: string }>(
      'SELECT usuario_id, numero_cuenta FROM cuentas_cobro WHERE id = $1 LIMIT 1',
      [datos.id],
    ).catch(() => [] as { usuario_id: string; numero_cuenta: string }[]);

    if (!cuenta) {
      return { ok: false, error: 'La cuenta de cobro no existe.' };
    }

    await query(
      `UPDATE cuentas_cobro SET
          estado=$1::character varying,
          motivo_rechazo=$2,
          autorizado_por=$3,
          fecha_autorizacion=CASE WHEN $1::text IN ('Autorizado','Rechazado') THEN NOW() ELSE fecha_autorizacion END,
          actualizado_en=NOW()
        WHERE id=$4`,
      [datos.estado, datos.motivoRechazo ?? null, datos.autorizadoPorId ?? null, datos.id],
    );

    const tipoMap: Record<string, string> = {
      'En revisión': 'cobro_en_revision',
      'Autorizado':  'cobro_autorizado',
      'Rechazado':   'cobro_rechazado',
      'Pagada':      'cobro_pagado',
    };

    const tituloMap: Record<string, string> = {
      'En revisión': 'Tu cuenta está en revisión',
      'Autorizado':  'Cuenta de cobro autorizada',
      'Rechazado':   'Cuenta de cobro rechazada',
      'Pagada':      'Pago realizado',
    };

    const descMap: Record<string, string> = {
      'En revisión': `Tu cuenta de cobro #${cuenta.numero_cuenta} está siendo revisada por Contabilidad.`,
      'Autorizado':  `Tu cuenta de cobro #${cuenta.numero_cuenta} fue aprobada y está en proceso de pago.`,
      'Rechazado':   `Tu cuenta de cobro #${cuenta.numero_cuenta} fue rechazada. Motivo: ${datos.motivoRechazo ?? 'Sin especificar'}.`,
      'Pagada':      `El pago de tu cuenta de cobro #${cuenta.numero_cuenta} ha sido efectuado exitosamente.`,
    };

    if (tipoMap[datos.estado]) {
      await crearNotificacion({
        paraUsuarioId: cuenta.usuario_id,
        deUsuarioId:   datos.autorizadoPorId,
        tipo:          tipoMap[datos.estado],
        titulo:        tituloMap[datos.estado],
        descripcion:   descMap[datos.estado],
        referenciaId:  datos.id,
      }).catch(() => null); 
    }

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Cobros] actualizarEstadoCuenta:', error);
    return { ok: false, error: 'No se pudo actualizar el estado de la cuenta.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARCAR COMO PAGADA
// ─────────────────────────────────────────────────────────────────────────────

const ROLES_PAGO: readonly string[] = ['CEO', 'CONTABLE'] as const;

export interface DatosMarcarPagada {
  cuentaId:    string;
  pagadoPorId: string;
  rolUsuario:  string;
}

export async function marcarComoPagada(
  datos: DatosMarcarPagada,
): Promise<ResultadoAccion> {
  const UUID_RE = UUID_REGEX;
  if (!UUID_RE.test(datos.cuentaId) || !UUID_RE.test(datos.pagadoPorId)) {
    return { ok: false, error: 'Identificadores inválidos.' };
  }

  const [verificarUsuario] = await query<{ rol_nombre: string }>(
    `SELECT r.nombre AS rol_nombre 
     FROM usuarios u 
     JOIN roles r ON r.id = u.rol_id 
     WHERE u.id = $1`,
    [datos.pagadoPorId]
  ).catch(() => []);

  const rolLimpio = verificarUsuario?.rol_nombre?.trim().toUpperCase();

  if (!rolLimpio || !ROLES_PAGO.includes(rolLimpio)) {
    return { ok: false, error: 'No tienes permiso para marcar cuentas como pagadas.' };
  }

  try {
    const [cuentaActual] = await query<{ estado: string; usuario_id: string; numero_cuenta: string }>(
      `SELECT estado, usuario_id, numero_cuenta FROM cuentas_cobro WHERE id = $1 LIMIT 1`,
      [datos.cuentaId],
    ).catch(() => [] as { estado: string; usuario_id: string; numero_cuenta: string }[]);

    if (!cuentaActual) {
      return { ok: false, error: 'Cuenta no encontrada.' };
    }

    if (cuentaActual.estado !== 'Autorizado') {
      return { ok: false, error: `Solo se pueden pagar cuentas autorizadas.` };
    }

    await query(
      `UPDATE cuentas_cobro SET estado='Pagada', pagado_por=$1, fecha_pago_real=NOW(), actualizado_en=NOW() WHERE id=$2`,
      [datos.pagadoPorId, datos.cuentaId],
    );

    await crearNotificacion({
      paraUsuarioId: cuentaActual.usuario_id,
      deUsuarioId:   datos.pagadoPorId,
      tipo:          'cobro_pagado',
      titulo:        'Pago realizado',
      descripcion:   `El pago de tu cuenta de cobro #${cuentaActual.numero_cuenta} ha sido efectuado.`,
      referenciaId:  datos.cuentaId,
    }).catch(() => null);

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Cobros] marcarComoPagada:', error);
    return { ok: false, error: 'No se pudo marcar la cuenta como pagada.' };
  }
}