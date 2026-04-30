'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface Notificacion {
  id: string;
  paraUsuarioId: string;
  deUsuarioId?: string;
  deUsuarioNombre?: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  referenciaId?: string;
  leida: boolean;
  creadoEn: string;
}

interface FilaNotificacion {
  id: string;
  para_usuario_id: string;
  de_usuario_id: string | null;
  de_usuario_nombre: string | null;
  tipo: string;
  titulo: string;
  descripcion: string;
  referencia_id: string | null;
  leida: boolean;
  creado_en: string;
}

function mapear(f: FilaNotificacion): Notificacion {
  return {
    id:              f.id,
    paraUsuarioId:   f.para_usuario_id,
    deUsuarioId:     f.de_usuario_id ?? undefined,
    deUsuarioNombre: f.de_usuario_nombre ?? undefined,
    tipo:            f.tipo,
    titulo:          f.titulo,
    descripcion:     f.descripcion,
    referenciaId:    f.referencia_id ?? undefined,
    leida:           f.leida,
    creadoEn:        f.creado_en,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Obtiene las notificaciones del usuario (máx 50, más recientes primero). */
export async function obtenerNotificaciones(usuarioId: string): Promise<{ ok: boolean; datos: Notificacion[]; noLeidas: number }> {
  if (!UUID_RE.test(usuarioId)) return { ok: false, datos: [], noLeidas: 0 };
  try {
    const filas = await query<FilaNotificacion>(
      `SELECT n.*, u.nombre_completo AS de_usuario_nombre
       FROM notificaciones n
       LEFT JOIN usuarios u ON u.id = n.de_usuario_id
       WHERE n.para_usuario_id = $1
       ORDER BY n.creado_en DESC
       LIMIT 50`,
      [usuarioId],
    );
    const noLeidas = filas.filter(f => !f.leida).length;
    return { ok: true, datos: filas.map(mapear), noLeidas };
  } catch {
    return { ok: false, datos: [], noLeidas: 0 };
  }
}

/** Marca una o todas las notificaciones del usuario como leídas. */
export async function marcarLeidas(usuarioId: string, ids?: string[]): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(usuarioId)) return { ok: false };
  try {
    if (ids && ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      await query(
        `UPDATE notificaciones SET leida = TRUE WHERE para_usuario_id = $1 AND id IN (${placeholders})`,
        [usuarioId, ...ids],
      );
    } else {
      await query(
        'UPDATE notificaciones SET leida = TRUE WHERE para_usuario_id = $1 AND leida = FALSE',
        [usuarioId],
      );
    }
    revalidatePath('/');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Crea una notificación manualmente (usado al autorizar/rechazar desde server actions). */
export async function crearNotificacion(datos: {
  paraUsuarioId: string;
  deUsuarioId?: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  referenciaId?: string;
}): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(datos.paraUsuarioId)) return { ok: false };
  try {
    await query(
      `INSERT INTO notificaciones (para_usuario_id, de_usuario_id, tipo, titulo, descripcion, referencia_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        datos.paraUsuarioId,
        datos.deUsuarioId ?? null,
        datos.tipo,
        datos.titulo,
        datos.descripcion,
        datos.referenciaId ?? null,
      ],
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
