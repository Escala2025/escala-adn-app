'use server';

/**
 * @fileoverview Server Actions para el módulo Bitácora Estratégica.
 * Maneja registros diarios de actividades, métricas de cierre y
 * feedback del CEO con notificaciones al usuario.
 *
 * Seguridad:
 *  - Personal_base / TI / Contable → solo sus propios registros (filtrado por usuario_id).
 *  - CEO → acceso total al dataset sin restricciones.
 */

import { query, withTransaction } from '@/lib/db';
import type { RegistroBitacora, ActividadBitacora, EstadoAnimico } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE RETORNO
// ─────────────────────────────────────────────────────────────────────────────

interface ResultadoSimple {
  ok: boolean;
  error?: string;
}

interface ResultadoRegistros {
  ok: boolean;
  datos?: RegistroBitacora[];
  error?: string;
}

interface ResultadoRegistro {
  ok: boolean;
  datos?: RegistroBitacora;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIONES
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esUUID = (v: string) => UUID_RE.test(v);

// ─────────────────────────────────────────────────────────────────────────────
// MAPPER: filas de BD → RegistroBitacora
// ─────────────────────────────────────────────────────────────────────────────

function mapearRegistro(
  row: Record<string, unknown>,
  actividades: ActividadBitacora[],
): RegistroBitacora {
  const totalHoras = actividades.reduce((s, a) => s + (a.horas ?? 0), 0);
  return {
    id:               row.id as string,
    usuarioId:        row.usuario_id as string,
    nombreUsuario:    row.nombre_usuario as string | undefined,
    fecha:            (row.fecha as Date).toISOString().slice(0, 10),
    actividades,
    porcentajeAvance: row.porcentaje_avance as number,
    estadoAnimico:    row.estado_animico as EstadoAnimico,
    totalHoras,
    comentarioCeo:    row.comentario_ceo as string | undefined,
    comentarioLeido:  row.comentario_leido as boolean,
    comentadoEn:      row.comentado_en
                        ? (row.comentado_en as Date).toISOString()
                        : undefined,
    creadoEn:         row.creado_en
                        ? (row.creado_en as Date).toISOString()
                        : undefined,
  };
}

function mapearActividad(row: Record<string, unknown>): ActividadBitacora {
  return {
    id:          row.id as string,
    registroId:  row.registro_id as string,
    descripcion: row.descripcion as string,
    horas:       parseFloat(row.horas as string),
    orden:       row.orden as number,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

async function cargarActividadesDe(registroIds: string[]): Promise<Map<string, ActividadBitacora[]>> {
  if (registroIds.length === 0) return new Map();
  const placeholders = registroIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<Record<string, unknown>>(
    `SELECT id, registro_id, descripcion, horas, orden
     FROM bitacora_actividades
     WHERE registro_id IN (${placeholders})
     ORDER BY registro_id, orden ASC, creado_en ASC`,
    registroIds,
  );
  const mapa = new Map<string, ActividadBitacora[]>();
  for (const row of rows) {
    const rid = row.registro_id as string;
    if (!mapa.has(rid)) mapa.set(rid, []);
    mapa.get(rid)!.push(mapearActividad(row));
  }
  return mapa;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Obtener registros del usuario (Personal_base / TI / Contable)
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerMisRegistros(usuarioId: string): Promise<ResultadoRegistros> {
  if (!esUUID(usuarioId)) return { ok: false, error: 'ID de usuario inválido.' };
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, usuario_id, fecha, porcentaje_avance, estado_animico,
              comentario_ceo, comentario_leido, comentado_en, creado_en
       FROM bitacora_registros
       WHERE usuario_id = $1
       ORDER BY fecha DESC
       LIMIT 90`,
      [usuarioId],
    );
    const ids = rows.map((r) => r.id as string);
    const actMap = await cargarActividadesDe(ids);
    const datos = rows.map((r) =>
      mapearRegistro(r, actMap.get(r.id as string) ?? []),
    );
    return { ok: true, datos };
  } catch (err) {
    console.error('[bitacora] obtenerMisRegistros:', err);
    return { ok: false, error: 'Error al cargar tus registros de bitácora.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Obtener todos los registros (solo CEO)
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerTodosLosRegistros(
  filtroUsuarioId?: string,
  fechaDesde?: string,
  fechaHasta?: string,
): Promise<ResultadoRegistros> {
  try {
    const params: unknown[] = [];
    const condiciones: string[] = [];

    if (filtroUsuarioId && esUUID(filtroUsuarioId)) {
      params.push(filtroUsuarioId);
      condiciones.push(`br.usuario_id = $${params.length}`);
    }
    if (fechaDesde) {
      params.push(fechaDesde);
      condiciones.push(`br.fecha >= $${params.length}`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      condiciones.push(`br.fecha <= $${params.length}`);
    }

    const WHERE = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const rows = await query<Record<string, unknown>>(
      `SELECT br.id, br.usuario_id, u.nombre_completo AS nombre_usuario,
              br.fecha, br.porcentaje_avance, br.estado_animico,
              br.comentario_ceo, br.comentario_leido, br.comentado_en, br.creado_en
       FROM bitacora_registros br
       JOIN usuarios u ON u.id = br.usuario_id
       ${WHERE}
       ORDER BY br.fecha DESC, u.nombre_completo ASC
       LIMIT 500`,
      params,
    );
    const ids = rows.map((r) => r.id as string);
    const actMap = await cargarActividadesDe(ids);
    const datos = rows.map((r) =>
      mapearRegistro(r, actMap.get(r.id as string) ?? []),
    );
    return { ok: true, datos };
  } catch (err) {
    console.error('[bitacora] obtenerTodosLosRegistros:', err);
    return { ok: false, error: 'Error al cargar los registros de bitácora.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Crear o actualizar registro del día
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarRegistroBitacora(datos: {
  usuarioId: string;
  fecha: string;
  actividades: Omit<ActividadBitacora, 'id' | 'registroId'>[];
  porcentajeAvance: number;
  estadoAnimico: EstadoAnimico;
}): Promise<ResultadoRegistro> {
  if (!esUUID(datos.usuarioId)) return { ok: false, error: 'ID de usuario inválido.' };
  if (!datos.actividades.length) return { ok: false, error: 'Debes agregar al menos una actividad.' };
  if (datos.porcentajeAvance < 0 || datos.porcentajeAvance > 100) {
    return { ok: false, error: 'El porcentaje de avance debe estar entre 0 y 100.' };
  }

  try {
    const resultado = await withTransaction(async (client) => {
      // Upsert del registro principal
      const { rows: regRows } = await client.query<Record<string, unknown>>(
        `INSERT INTO bitacora_registros
           (usuario_id, fecha, porcentaje_avance, estado_animico)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (usuario_id, fecha) DO UPDATE SET
           porcentaje_avance = EXCLUDED.porcentaje_avance,
           estado_animico    = EXCLUDED.estado_animico,
           actualizado_en    = NOW()
         RETURNING id, usuario_id, fecha, porcentaje_avance, estado_animico,
                   comentario_ceo, comentario_leido, comentado_en, creado_en`,
        [datos.usuarioId, datos.fecha, datos.porcentajeAvance, datos.estadoAnimico],
      );
      const registro = regRows[0];
      const registroId = registro.id as string;

      // Borrar actividades anteriores y reinsertar
      await client.query('DELETE FROM bitacora_actividades WHERE registro_id = $1', [registroId]);
      for (let i = 0; i < datos.actividades.length; i++) {
        const act = datos.actividades[i];
        await client.query(
          `INSERT INTO bitacora_actividades (registro_id, descripcion, horas, orden)
           VALUES ($1, $2, $3, $4)`,
          [registroId, act.descripcion.trim(), act.horas, i + 1],
        );
      }

      // Cargar actividades insertadas para devolver
      const { rows: actRows } = await client.query<Record<string, unknown>>(
        `SELECT id, registro_id, descripcion, horas, orden
         FROM bitacora_actividades WHERE registro_id = $1 ORDER BY orden`,
        [registroId],
      );

      return mapearRegistro(registro, actRows.map(mapearActividad));
    });

    return { ok: true, datos: resultado };
  } catch (err) {
    console.error('[bitacora] guardarRegistroBitacora:', err);
    return { ok: false, error: 'Error al guardar el registro de bitácora.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: CEO guarda comentario sobre un registro
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarComentarioCeo(
  registroId: string,
  comentario: string,
): Promise<ResultadoSimple> {
  if (!esUUID(registroId)) return { ok: false, error: 'ID de registro inválido.' };
  const texto = comentario.trim();
  if (!texto) return { ok: false, error: 'El comentario no puede estar vacío.' };
  try {
    await query(
      `UPDATE bitacora_registros
       SET comentario_ceo   = $1,
           comentario_leido = FALSE,
           comentado_en     = NOW(),
           actualizado_en   = NOW()
       WHERE id = $2`,
      [texto, registroId],
    );
    return { ok: true };
  } catch (err) {
    console.error('[bitacora] guardarComentarioCeo:', err);
    return { ok: false, error: 'Error al guardar el comentario.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Marcar comentario como leído
// ─────────────────────────────────────────────────────────────────────────────

export async function marcarComentarioLeido(registroId: string): Promise<ResultadoSimple> {
  if (!esUUID(registroId)) return { ok: false, error: 'ID de registro inválido.' };
  try {
    await query(
      `UPDATE bitacora_registros
       SET comentario_leido = TRUE, actualizado_en = NOW()
       WHERE id = $1`,
      [registroId],
    );
    return { ok: true };
  } catch (err) {
    console.error('[bitacora] marcarComentarioLeido:', err);
    return { ok: false, error: 'Error al marcar como leído.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Obtener usuarios para el selector del CEO
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerUsuariosParaBitacora(): Promise<{
  ok: boolean;
  datos?: { id: string; nombreCompleto: string }[];
  error?: string;
}> {
  try {
    const rows = await query<{ id: string; nombre_completo: string }>(
      `SELECT u.id, u.nombre_completo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.activo = TRUE AND r.nombre != 'Proveedor'
       ORDER BY u.nombre_completo ASC`,
    );
    return { ok: true, datos: rows.map((r) => ({ id: r.id, nombreCompleto: r.nombre_completo })) };
  } catch (err) {
    console.error('[bitacora] obtenerUsuariosParaBitacora:', err);
    return { ok: false, error: 'Error al cargar usuarios.' };
  }
}
