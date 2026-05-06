'use server';

/**
 * @fileoverview Server Actions CRUD para las tablas `proveedores`
 * y `transacciones_proveedores`.
 *
 * NOTA IMPORTANTE: Las transacciones_proveedores son INMUTABLES por política
 * de auditoría financiera (trigger en la BD). Solo se permite INSERT.
 */

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import type {
  Proveedor,
  TransaccionProveedor,
  RegimenTributario,
  DocumentoProveedor,
  TipoDocumentoProveedor,
} from '@/lib/tipos';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

export interface ResultadoConDatos<T> extends ResultadoAccion {
  datos?: T;
}

const TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS: TipoDocumentoProveedor[] = [
  'cedula_ciudadania',
  'rut',
  'hoja_vida_cv',
  'antecedentes_policia_procuraduria',
  'antecedentes_fiscales_contraloria',
  'referencias_comerciales_personales',
];

function normalizarBase64(valor: string): string {
  const v = (valor ?? '').trim();
  if (v.startsWith('data:')) {
    const idx = v.indexOf(',');
    if (idx !== -1) return v.slice(idx + 1).replace(/[\r\n\s]/g, '');
  }
  return v.replace(/[\r\n\s]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDORES — READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna todos los proveedores ordenados por fecha de creación.
 */
export async function obtenerProveedores(): Promise<ResultadoConDatos<Proveedor[]>> {
  try {
    const filas = await query<{
      id: string;
      razon_social: string;
      nit_cedula: string;
      direccion: string | null;
      ciudad: string | null;
      telefono: string | null;
      correo: string | null;
      regimen_tributario: string;
      responsabilidades_fiscales: string | null;
      servicios: string | null;
      activo: boolean;
      creado_en: string;
    }>(
      `SELECT
         id, razon_social, nit_cedula, direccion, ciudad, telefono, correo,
         regimen_tributario, responsabilidades_fiscales, servicios, activo, creado_en
       FROM proveedores
       ORDER BY creado_en ASC`,
    );

    const proveedores: Proveedor[] = filas.map(f => ({
      id:                       f.id,
      razonSocial:              f.razon_social,
      nitCedula:                f.nit_cedula,
      direccion:                f.direccion ?? '',
      ciudad:                   f.ciudad ?? '',
      telefono:                 f.telefono ?? '',
      correo:                   f.correo ?? '',
      regimen:                  f.regimen_tributario as RegimenTributario,
      responsabilidadesFiscales: f.responsabilidades_fiscales ?? '',
      servicios:                f.servicios ?? '',
      activo:                   f.activo,
      fechaCreacion:            f.creado_en,
    }));

    return { ok: true, datos: proveedores };
  } catch (error) {
    console.error('[Proveedores] obtenerProveedores:', error);
    return { ok: false, error: 'No se pudo obtener la lista de proveedores.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDORES — CREATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosCrearProveedor {
  razonSocial:              string;
  nitCedula:                string;
  direccion?:               string;
  ciudad?:                  string;
  telefono?:                string;
  correo?:                  string;
  regimen:                  RegimenTributario;
  responsabilidadesFiscales?: string;
  servicios?:               string;
  registradoPorId?:         string; // UUID del usuario que registra
}

export async function crearProveedor(
  datos: DatosCrearProveedor,
): Promise<ResultadoConDatos<Proveedor>> {
  try {
    const filas = await query<{ id: string; creado_en: string }>(
      `INSERT INTO proveedores
         (razon_social, nit_cedula, direccion, ciudad, telefono, correo,
          regimen_tributario, responsabilidades_fiscales, servicios, registrado_por, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
       RETURNING id, creado_en`,
      [
        datos.razonSocial,
        datos.nitCedula,
        datos.direccion ?? null,
        datos.ciudad ?? null,
        datos.telefono ?? null,
        datos.correo ?? null,
        datos.regimen,
        datos.responsabilidadesFiscales ?? null,
        datos.servicios ?? null,
        datos.registradoPorId ?? null,
      ],
    );

    const nuevo: Proveedor = {
      id:                       filas[0].id,
      razonSocial:              datos.razonSocial,
      nitCedula:                datos.nitCedula,
      direccion:                datos.direccion ?? '',
      ciudad:                   datos.ciudad ?? '',
      telefono:                 datos.telefono ?? '',
      correo:                   datos.correo ?? '',
      regimen:                  datos.regimen,
      responsabilidadesFiscales: datos.responsabilidadesFiscales ?? '',
      servicios:                datos.servicios ?? '',
      activo:                   true,
      fechaCreacion:            filas[0].creado_en,
    };

    revalidatePath('/');
    return { ok: true, datos: nuevo };
  } catch (error: unknown) {
    console.error('[Proveedores] crearProveedor:', error);
    const msg = String(error);
    if (msg.includes('nit_cedula') || msg.includes('unique')) {
      return { ok: false, error: 'Ya existe un proveedor con ese NIT/Cédula.' };
    }
    return { ok: false, error: 'No se pudo registrar el proveedor.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDORES — UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarProveedor(
  id: string,
  datos: Partial<DatosCrearProveedor>,
): Promise<ResultadoAccion> {
  try {
    await query(
      `UPDATE proveedores SET
         razon_social=$1, nit_cedula=$2, direccion=$3, ciudad=$4, telefono=$5,
         correo=$6, regimen_tributario=$7, responsabilidades_fiscales=$8,
         servicios=$9, actualizado_en=NOW()
       WHERE id=$10`,
      [
        datos.razonSocial, datos.nitCedula, datos.direccion ?? null,
        datos.ciudad ?? null, datos.telefono ?? null, datos.correo ?? null,
        datos.regimen, datos.responsabilidadesFiscales ?? null,
        datos.servicios ?? null, id,
      ],
    );
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Proveedores] actualizarProveedor:', error);
    return { ok: false, error: 'No se pudo actualizar el proveedor.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACCIONES — READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna las transacciones de un proveedor (o todas si no se especifica).
 */
/**
 * Retorna las transacciones de un proveedor (o todas si no se especifica).
 */
export async function obtenerTransacciones(
  proveedorId?: string,
): Promise<ResultadoConDatos<TransaccionProveedor[]>> {
  try {
    const sql = proveedorId
      ? `SELECT
           t.id, t.proveedor_id, t.valor_cop, t.concepto,
           t.numero_comprobante, t.url_soporte_drive,
           t.fecha_pago, t.hora_pago,
           u.nombre_completo AS registrado_por_nombre
         FROM transacciones_proveedores t
         LEFT JOIN usuarios u ON u.id = t.registrado_por
         WHERE t.proveedor_id = $1
         ORDER BY t.fecha_pago DESC, t.creado_en DESC`
      : `SELECT
           t.id, t.proveedor_id, t.valor_cop, t.concepto,
           t.numero_comprobante, t.url_soporte_drive,
           t.fecha_pago, t.hora_pago,
           u.nombre_completo AS registrado_por_nombre
         FROM transacciones_proveedores t
         LEFT JOIN usuarios u ON u.id = t.registrado_por
         ORDER BY t.fecha_pago DESC, t.creado_en DESC`;

    const filas = await query<{
      id: string;
      proveedor_id: string;
      valor_cop: string;
      concepto: string;
      numero_comprobante: string | null;
      url_soporte_drive: string | null;
      // CAMBIO 1: Se define como string | Date para evitar conflictos con instanceof
      fecha_pago: string | Date;
      hora_pago: string | Date | null;
      registrado_por_nombre: string | null;
    }>(sql, proveedorId ? [proveedorId] : []);

    const transacciones: TransaccionProveedor[] = filas.map(f => ({
      id:                f.id,
      proveedorId:       f.proveedor_id,
      // CAMBIO 2: Usamos new Date() directamente. Es seguro tanto para string como para objeto Date.
      fecha: f.fecha_pago 
        ? new Date(f.fecha_pago).toISOString().slice(0, 10) 
        : '',
      // CAMBIO 3: Simplificamos el manejo de la hora convirtiendo a string y recortando
      hora: f.hora_pago 
        ? String(f.hora_pago).slice(0, 5) 
        : '',
      valor:             parseInt(f.valor_cop, 10),
      concepto:          f.concepto,
      numeroComprobante: f.numero_comprobante ?? '',
      soportePagoUrl:    f.url_soporte_drive ?? undefined,
      registradoPor:     f.registrado_por_nombre ?? 'Desconocido',
    }));

    return { ok: true, datos: transacciones };
  } catch (error) {
    console.error('[Proveedores] obtenerTransacciones:', error);
    return { ok: false, error: 'No se pudo obtener el historial de pagos.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACCIONES — CREATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosCrearTransaccion {
  proveedorId:        string;
  valor:              number;
  concepto:           string;
  numeroComprobante?: string;
  fecha:              string; // YYYY-MM-DD
  hora?:              string; // HH:MM
  registradoPorId:    string; // UUID del usuario
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDORES — TOGGLE ESTADO (activar / desactivar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activa o desactiva un proveedor.
 * @param id     UUID del proveedor.
 * @param activo Nuevo estado: true = activo, false = inactivo.
 */
export async function toggleEstadoProveedor(
  id: string,
  activo: boolean,
): Promise<ResultadoAccion> {
  try {
    await query(
      `UPDATE proveedores SET activo=$1, actualizado_en=NOW() WHERE id=$2`,
      [activo, id],
    );
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Proveedores] toggleEstadoProveedor:', error);
    return { ok: false, error: 'No se pudo cambiar el estado del proveedor.' };
  }
}

/**
 * Elimina un proveedor y todas sus transacciones asociadas de la BD.
 * Se usa CASCADE en la BD (o se eliminan transacciones primero).
 */
export async function eliminarProveedor(id: string): Promise<ResultadoAccion> {
  try {
    // Eliminar transacciones asociadas primero (por si no hay CASCADE en la BD)
    await query(`DELETE FROM transacciones_proveedores WHERE proveedor_id=$1`, [id]);
    await query(`DELETE FROM proveedores WHERE id=$1`, [id]);
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Proveedores] eliminarProveedor:', error);
    return { ok: false, error: 'No se pudo eliminar el proveedor.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACCIONES — CREATE
// ─────────────────────────────────────────────────────────────────────────────

export async function crearTransaccion(
  datos: DatosCrearTransaccion,
): Promise<ResultadoConDatos<TransaccionProveedor>> {
  try {
    const comprobante = datos.numeroComprobante || `COMP-${Date.now()}`;

    const filas = await query<{ id: string }>(
      `INSERT INTO transacciones_proveedores
         (proveedor_id, valor_cop, concepto, numero_comprobante, fecha_pago, hora_pago, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        datos.proveedorId,
        datos.valor,
        datos.concepto,
        comprobante,
        datos.fecha,
        datos.hora ?? null,
        datos.registradoPorId,
      ],
    );

    const usuarios = await query<{ nombre_completo: string }>(
      'SELECT nombre_completo FROM usuarios WHERE id=$1',
      [datos.registradoPorId],
    );

    const nueva: TransaccionProveedor = {
      id:                filas[0].id,
      proveedorId:       datos.proveedorId,
      fecha:             datos.fecha,
      hora:              datos.hora ?? '',
      valor:             datos.valor,
      concepto:          datos.concepto,
      numeroComprobante: comprobante,
      registradoPor:     usuarios[0]?.nombre_completo ?? 'Desconocido',
    };

    revalidatePath('/');
    return { ok: true, datos: nueva };
  } catch (error) {
    console.error('[Proveedores] crearTransaccion:', error);
    return { ok: false, error: 'No se pudo registrar el pago.' };
  }
}

/** Alias de crearTransaccion — nombre usado en page.tsx. */
export async function agregarTransaccion(
  datos: DatosCrearTransaccion,
): Promise<ResultadoConDatos<TransaccionProveedor>> {
  return crearTransaccion(datos);
}

/**
 * Elimina una transacción por ID.
 */
export async function eliminarTransaccion(id: string): Promise<ResultadoAccion> {
  try {
    await query(`DELETE FROM transacciones_proveedores WHERE id=$1`, [id]);
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Proveedores] eliminarTransaccion:', error);
    return { ok: false, error: 'No se pudo eliminar la transacción.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS DE PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentoProveedorInput {
  tipoDocumento: TipoDocumentoProveedor;
  nombreArchivo: string;
  mimeType: string;
  contenidoBase64: string;
}

export interface DatosRegistrarProveedorConDocumentos extends DatosCrearProveedor {
  documentos: DocumentoProveedorInput[];
}

export async function registrarProveedorConDocumentos(
  datos: DatosRegistrarProveedorConDocumentos,
): Promise<ResultadoConDatos<Proveedor>> {
  if (!Array.isArray(datos.documentos) || datos.documentos.length === 0) {
    return { ok: false, error: 'Debes adjuntar los documentos obligatorios en PDF.' };
  }

  const tiposRecibidos = new Set(datos.documentos.map(d => d.tipoDocumento));
  const faltantes = TIPOS_DOCUMENTO_PROVEEDOR_REQUERIDOS.filter(t => !tiposRecibidos.has(t));
  if (faltantes.length > 0) {
    return { ok: false, error: 'Faltan documentos obligatorios para registrar el proveedor.' };
  }

  for (const doc of datos.documentos) {
    if ((doc.mimeType ?? '').toLowerCase() !== 'application/pdf') {
      return { ok: false, error: `El documento ${doc.nombreArchivo} no es PDF válido.` };
    }
    const limpio = normalizarBase64(doc.contenidoBase64);
    if (!limpio) {
      return { ok: false, error: `El documento ${doc.nombreArchivo} está vacío.` };
    }
  }

  try {
    await query('BEGIN');

    const filasProveedor = await query<{ id: string; creado_en: string }>(
      `INSERT INTO proveedores
         (razon_social, nit_cedula, direccion, ciudad, telefono, correo,
          regimen_tributario, responsabilidades_fiscales, servicios, registrado_por, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
       RETURNING id, creado_en`,
      [
        datos.razonSocial,
        datos.nitCedula,
        datos.direccion ?? null,
        datos.ciudad ?? null,
        datos.telefono ?? null,
        datos.correo ?? null,
        datos.regimen,
        datos.responsabilidadesFiscales ?? null,
        datos.servicios ?? null,
        datos.registradoPorId ?? null,
      ],
    );

    const proveedorId = filasProveedor[0].id;

    for (const doc of datos.documentos) {
      await query(
        `INSERT INTO documentos_proveedor
          (proveedor_id, tipo_documento, nombre_archivo, mime_type, contenido_base64)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (proveedor_id, tipo_documento)
         DO UPDATE SET
           nombre_archivo=EXCLUDED.nombre_archivo,
           mime_type=EXCLUDED.mime_type,
           contenido_base64=EXCLUDED.contenido_base64,
           actualizado_en=NOW()`,
        [
          proveedorId,
          doc.tipoDocumento,
          doc.nombreArchivo,
          'application/pdf',
          normalizarBase64(doc.contenidoBase64),
        ],
      );
    }

    await query('COMMIT');

    const nuevo: Proveedor = {
      id: proveedorId,
      razonSocial: datos.razonSocial,
      nitCedula: datos.nitCedula,
      direccion: datos.direccion ?? '',
      ciudad: datos.ciudad ?? '',
      telefono: datos.telefono ?? '',
      correo: datos.correo ?? '',
      regimen: datos.regimen,
      responsabilidadesFiscales: datos.responsabilidadesFiscales ?? '',
      servicios: datos.servicios ?? '',
      activo: true,
      fechaCreacion: filasProveedor[0].creado_en,
    };

    revalidatePath('/');
    return { ok: true, datos: nuevo };
  } catch (error: unknown) {
    await query('ROLLBACK').catch(() => null);
    console.error('[Proveedores] registrarProveedorConDocumentos:', error);
    const msg = String(error);
    if (msg.includes('nit_cedula') || msg.includes('unique')) {
      return { ok: false, error: 'Ya existe un proveedor con ese NIT/Cédula.' };
    }
    return { ok: false, error: 'No se pudo registrar el proveedor con documentos.' };
  }
}

export async function obtenerDocumentosProveedor(
  proveedorId: string,
): Promise<ResultadoConDatos<DocumentoProveedor[]>> {
  try {
    const filas = await query<{
      id: string;
      proveedor_id: string;
      tipo_documento: TipoDocumentoProveedor;
      nombre_archivo: string;
      mime_type: string;
      creado_en: string;
      actualizado_en: string;
    }>(
      `SELECT id, proveedor_id, tipo_documento, nombre_archivo, mime_type, creado_en, actualizado_en
       FROM documentos_proveedor
       WHERE proveedor_id = $1
       ORDER BY tipo_documento ASC`,
      [proveedorId],
    );

    const docs: DocumentoProveedor[] = filas.map(f => ({
      id: f.id,
      proveedorId: f.proveedor_id,
      tipoDocumento: f.tipo_documento,
      nombreArchivo: f.nombre_archivo,
      mimeType: f.mime_type,
      creadoEn: f.creado_en,
      actualizadoEn: f.actualizado_en,
    }));

    return { ok: true, datos: docs };
  } catch (error) {
    console.error('[Proveedores] obtenerDocumentosProveedor:', error);
    return { ok: false, error: 'No se pudo obtener la carpeta documental del proveedor.' };
  }
}

export async function obtenerDocumentoProveedor(
  proveedorId: string,
  tipoDocumento: TipoDocumentoProveedor,
): Promise<ResultadoConDatos<DocumentoProveedor>> {
  try {
    const filas = await query<{
      id: string;
      proveedor_id: string;
      tipo_documento: TipoDocumentoProveedor;
      nombre_archivo: string;
      mime_type: string;
      contenido_base64: string;
      creado_en: string;
      actualizado_en: string;
    }>(
      `SELECT id, proveedor_id, tipo_documento, nombre_archivo, mime_type, contenido_base64, creado_en, actualizado_en
       FROM documentos_proveedor
       WHERE proveedor_id = $1 AND tipo_documento = $2
       LIMIT 1`,
      [proveedorId, tipoDocumento],
    );

    const f = filas[0];
    if (!f) return { ok: false, error: 'Documento no encontrado.' };

    return {
      ok: true,
      datos: {
        id: f.id,
        proveedorId: f.proveedor_id,
        tipoDocumento: f.tipo_documento,
        nombreArchivo: f.nombre_archivo,
        mimeType: f.mime_type,
        contenidoBase64: f.contenido_base64,
        creadoEn: f.creado_en,
        actualizadoEn: f.actualizado_en,
      },
    };
  } catch (error) {
    console.error('[Proveedores] obtenerDocumentoProveedor:', error);
    return { ok: false, error: 'No se pudo obtener el documento.' };
  }
}

export interface DatosActualizarDocumentoProveedor {
  proveedorId: string;
  tipoDocumento: TipoDocumentoProveedor;
  nombreArchivo: string;
  mimeType: string;
  contenidoBase64: string;
}

export async function actualizarDocumentoProveedor(
  datos: DatosActualizarDocumentoProveedor,
): Promise<ResultadoAccion> {
  try {
    if ((datos.mimeType ?? '').toLowerCase() !== 'application/pdf') {
      return { ok: false, error: 'Solo se permiten archivos PDF.' };
    }
    const limpio = normalizarBase64(datos.contenidoBase64);
    if (!limpio) return { ok: false, error: 'El contenido del archivo está vacío.' };

    await query(
      `INSERT INTO documentos_proveedor
        (proveedor_id, tipo_documento, nombre_archivo, mime_type, contenido_base64)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (proveedor_id, tipo_documento)
       DO UPDATE SET
         nombre_archivo=EXCLUDED.nombre_archivo,
         mime_type=EXCLUDED.mime_type,
         contenido_base64=EXCLUDED.contenido_base64,
         actualizado_en=NOW()`,
      [
        datos.proveedorId,
        datos.tipoDocumento,
        datos.nombreArchivo,
        'application/pdf',
        limpio,
      ],
    );

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Proveedores] actualizarDocumentoProveedor:', error);
    return { ok: false, error: 'No se pudo actualizar el documento.' };
  }
}
