'use server';

/**
 * @fileoverview Server Actions para el módulo Directorio del Personal.
 * Gestiona el historial de pagos de colaboradores internos (tabla pagos_personal).
 * Los pagos son INMUTABLES por política de auditoría financiera.
 * Exports: obtenerPagosDeUsuario, crearPagoPersonal
 */

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import type { PagoPersonal, TipoPagoPersonal } from '@/lib/tipos';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

export interface ResultadoConDatos<T> extends ResultadoAccion {
  datos?: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGOS DEL PERSONAL — READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el historial de pagos de un colaborador específico.
 * Seguro: filtra por usuario_id en BD.
 */
export async function obtenerPagosDeUsuario(
  usuarioId: string,
): Promise<ResultadoConDatos<PagoPersonal[]>> {
  if (!usuarioId?.match(/^[0-9a-f-]{36}$/i)) {
    return { ok: false, error: 'ID de usuario inválido.' };
  }
  try {
    const filas = await query<{
      id: string;
      usuario_id: string;
      valor_cop: string;
      concepto: string;
      numero_comprobante: string | null;
      tipo_pago: string;
      // CAMBIO 1: Permitimos que sea Date o string para que el compilador no sufra
      fecha_pago: string | Date; 
      hora_pago: string | Date | null;
      periodo: string | null;
      notas: string | null;
      registrado_por_nombre: string | null;
      creado_en: string | Date;
    }>(
      `SELECT
          p.id, p.usuario_id, p.valor_cop, p.concepto,
          p.numero_comprobante, p.tipo_pago, p.fecha_pago, p.hora_pago,
          p.periodo, p.notas, p.creado_en,
          u.nombre_completo AS registrado_por_nombre
        FROM pagos_personal p
        LEFT JOIN usuarios u ON u.id = p.registrado_por
        WHERE p.usuario_id = $1
        ORDER BY p.fecha_pago DESC, p.creado_en DESC`,
      [usuarioId],
    );

    return {
      ok: true,
      datos: filas.map(f => ({
        id:                 f.id,
        usuarioId:          f.usuario_id,
        valorCop:           parseInt(f.valor_cop, 10),
        concepto:           f.concepto,
        numeroComprobante:  f.numero_comprobante ?? undefined,
        tipoPago:           f.tipo_pago as TipoPagoPersonal,
        // CAMBIO 2: Lógica simplificada sin 'instanceof'
        fechaPago: f.fecha_pago 
          ? new Date(f.fecha_pago).toISOString().slice(0, 10) 
          : '',
        horaPago: f.hora_pago 
          ? String(f.hora_pago).slice(0, 5) 
          : undefined,
        periodo:            f.periodo ?? undefined,
        notas:              f.notas ?? undefined,
        registrado_por:     f.registrado_por_nombre ?? 'Desconocido',
        creadoEn:           String(f.creado_en),
      })),
    };
  } catch (error) {
    console.error('[Directorio] obtenerPagosDeUsuario:', error);
    return { ok: false, error: 'No se pudo obtener el historial de pagos.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGOS DEL PERSONAL — CREATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosCrearPagoPersonal {
  usuarioId:          string;
  valorCop:           number;
  concepto:           string;
  numeroComprobante?: string;
  tipoPago:           TipoPagoPersonal;
  fechaPago:          string;   // YYYY-MM-DD
  horaPago?:          string;   // HH:MM
  periodo?:           string;
  notas?:             string;
  registradoPorId:    string;   // UUID del usuario que registra (CEO/TI/Contable)
}

export async function crearPagoPersonal(
  datos: DatosCrearPagoPersonal,
): Promise<ResultadoConDatos<PagoPersonal>> {
  if (!datos.usuarioId?.match(/^[0-9a-f-]{36}$/i)) {
    return { ok: false, error: 'ID de colaborador inválido.' };
  }
  if (!datos.registradoPorId?.match(/^[0-9a-f-]{36}$/i)) {
    return { ok: false, error: 'ID de registrador inválido.' };
  }
  if (datos.valorCop <= 0) {
    return { ok: false, error: 'El valor debe ser mayor a cero.' };
  }

  try {
    const comprobante = datos.numeroComprobante || `PP-${Date.now()}`;

    const filas = await query<{ id: string; creado_en: string }>(
      `INSERT INTO pagos_personal
         (usuario_id, valor_cop, concepto, numero_comprobante, tipo_pago,
          fecha_pago, hora_pago, periodo, notas, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, creado_en`,
      [
        datos.usuarioId,
        datos.valorCop,
        datos.concepto,
        comprobante,
        datos.tipoPago,
        datos.fechaPago,
        datos.horaPago ?? null,
        datos.periodo ?? null,
        datos.notas ?? null,
        datos.registradoPorId,
      ],
    );

    const registrador = await query<{ nombre_completo: string }>(
      'SELECT nombre_completo FROM usuarios WHERE id=$1',
      [datos.registradoPorId],
    );

    const nuevo: PagoPersonal = {
      id:                filas[0].id,
      usuarioId:         datos.usuarioId,
      valorCop:          datos.valorCop,
      concepto:          datos.concepto,
      numeroComprobante: comprobante,
      tipoPago:          datos.tipoPago,
      fechaPago:         datos.fechaPago,
      horaPago:          datos.horaPago,
      periodo:           datos.periodo,
      notas:             datos.notas,
      registradoPor:     registrador[0]?.nombre_completo ?? 'Desconocido',
      creadoEn:          filas[0].creado_en,
    };

    revalidatePath('/');
    return { ok: true, datos: nuevo };
  } catch (error) {
    console.error('[Directorio] crearPagoPersonal:', error);
    return { ok: false, error: 'No se pudo registrar el pago.' };
  }
}
