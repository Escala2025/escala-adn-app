'use server';

/**
 * @fileoverview Server Actions para el registro y consulta de auditoría.
 * registrarAccion() puede llamarse desde cualquier otra action para
 * registrar eventos de forma no bloqueante.
 * listarAcciones() solo debe usarse desde componentes de CEO o TI.
 */

import { query } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface AccionAuditoria {
  id: string;
  usuarioId: string | null;
  nombreUsuario: string | null;
  rolUsuario: string | null;
  modulo: string;
  accion: string;
  descripcion: string | null;
  referenciaId: string | null;
  ipOrigen: string | null;
  creadoEn: string;
}

export interface ParametrosRegistro {
  usuarioId?: string | null;
  nombreUsuario?: string;
  rolUsuario?: string;
  modulo: string;
  accion: string;
  descripcion?: string;
  referenciaId?: string;
  ipOrigen?: string;
}

export interface ResultadoAuditoria {
  ok: boolean;
  datos: AccionAuditoria[];
  total: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR ACCIÓN (llamada interna desde otras actions)
// ─────────────────────────────────────────────────────────────────────────────

export async function registrarAccion(params: ParametrosRegistro): Promise<void> {
  try {
    // Si hay usuarioId pero no nombre, intentar obtenerlo
    let nombre = params.nombreUsuario ?? null;
    let rol    = params.rolUsuario ?? null;

    if (params.usuarioId && (!nombre || !rol)) {
      const filas = await query<{ nombre_completo: string; rol_nombre: string }>(
        `SELECT u.nombre_completo, r.nombre AS rol_nombre
           FROM usuarios u JOIN roles r ON r.id = u.rol_id
          WHERE u.id = $1 LIMIT 1`,
        [params.usuarioId],
      ).catch(() => [] as { nombre_completo: string; rol_nombre: string }[]);

      if (filas.length > 0) {
        nombre = nombre ?? filas[0].nombre_completo;
        rol    = rol    ?? filas[0].rol_nombre;
      }
    }

    await query(
      `INSERT INTO auditoria_acciones
         (usuario_id, nombre_usuario, rol_usuario, modulo, accion, descripcion, referencia_id, ip_origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet)`,
      [
        params.usuarioId ?? null,
        nombre,
        rol,
        params.modulo,
        params.accion,
        params.descripcion ?? null,
        params.referenciaId ?? null,
        params.ipOrigen ?? null,
      ],
    );
  } catch (error) {
    // No propagar — la auditoría no debe bloquear la operación principal
    console.error('[Auditoria] registrarAccion falló (no crítico):', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR ACCIONES (CEO y TI únicamente)
// ─────────────────────────────────────────────────────────────────────────────

export async function listarAcciones(opciones: {
  modulo?: string;
  accion?: string;
  usuarioId?: string;
  limite?: number;
  offset?: number;
} = {}): Promise<ResultadoAuditoria> {
  const { modulo, accion, usuarioId, limite = 100, offset = 0 } = opciones;

  try {
    const condiciones: string[] = [];
    const valores: unknown[]    = [];
    let idx = 1;

    if (modulo)    { condiciones.push(`modulo = $${idx++}`);     valores.push(modulo); }
    if (accion)    { condiciones.push(`accion = $${idx++}`);     valores.push(accion); }
    if (usuarioId) { condiciones.push(`usuario_id = $${idx++}`); valores.push(usuarioId); }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [filas, total] = await Promise.all([
      query<{
        id: string; usuario_id: string | null; nombre_usuario: string | null;
        rol_usuario: string | null; modulo: string; accion: string;
        descripcion: string | null; referencia_id: string | null;
        ip_origen: string | null; creado_en: string;
      }>(
        `SELECT id, usuario_id, nombre_usuario, rol_usuario, modulo, accion,
                descripcion, referencia_id, ip_origen, creado_en
           FROM auditoria_acciones
           ${where}
           ORDER BY creado_en DESC
           LIMIT $${idx++} OFFSET $${idx}`,
        [...valores, limite, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM auditoria_acciones ${where}`,
        valores,
      ),
    ]);

    return {
      ok: true,
      datos: filas.map(f => ({
        id:           f.id,
        usuarioId:    f.usuario_id,
        nombreUsuario: f.nombre_usuario,
        rolUsuario:   f.rol_usuario,
        modulo:       f.modulo,
        accion:       f.accion,
        descripcion:  f.descripcion,
        referenciaId: f.referencia_id,
        ipOrigen:     f.ip_origen,
        creadoEn:     f.creado_en,
      })),
      total: parseInt(total[0]?.count ?? '0', 10),
    };
  } catch (error) {
    console.error('[Auditoria] listarAcciones:', error);
    return { ok: false, datos: [], total: 0, error: 'Error al consultar la auditoría.' };
  }
}
