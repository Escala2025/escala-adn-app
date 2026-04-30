'use server';

/**
 * @fileoverview Server Actions para gestión del perfil del usuario.
 * Permite actualizar nombre_visible y foto_url (avatar).
 * Cualquier usuario autenticado puede editar su propio perfil.
 */

import { query } from '@/lib/db';
import type { Usuario, RolUsuario } from '@/lib/tipos';
import { registrarAccion } from '@/lib/actions/auditoria-actions';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoPerfil {
  ok: boolean;
  error?: string;
  usuario?: Usuario;
}

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER PERFIL COMPLETO
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerPerfil(usuarioId: string): Promise<ResultadoPerfil> {
  try {
    const filas = await query<{
      id: string; nombre_completo: string; correo: string;
      telefono: string | null; cargo: string | null; rol_nombre: string;
      activo: boolean; creado_en: string; foto_url: string | null;
      nombre_visible: string | null;
    }>(
      `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.cargo,
              r.nombre AS rol_nombre, u.activo, u.creado_en,
              u.foto_url, u.nombre_visible
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
        WHERE u.id = $1 LIMIT 1`,
      [usuarioId],
    );

    if (filas.length === 0) return { ok: false, error: 'Usuario no encontrado.' };

    const f = filas[0];
    const usuario: Usuario = {
      id:             f.id,
      nombreCompleto: f.nombre_completo,
      correo:         f.correo,
      telefono:       f.telefono ?? '',
      cargo:          f.cargo ?? '',
      rol:            f.rol_nombre as RolUsuario,
      activo:         f.activo,
      fechaCreacion:  f.creado_en,
      fotoUrl:        f.foto_url ?? undefined,
      nombreVisible:  f.nombre_visible ?? undefined,
    };
    return { ok: true, usuario };
  } catch (error) {
    console.error('[Perfil] obtenerPerfil:', error);
    return { ok: false, error: 'Error al obtener el perfil.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR NOMBRE VISIBLE
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarNombreVisible(
  usuarioId: string,
  nombreVisible: string,
): Promise<ResultadoPerfil> {
  const nombre = nombreVisible.trim();
  if (!nombre || nombre.length < 2) {
    return { ok: false, error: 'El nombre debe tener al menos 2 caracteres.' };
  }
  if (nombre.length > 60) {
    return { ok: false, error: 'El nombre no puede superar 60 caracteres.' };
  }

  try {
    await query(
      'UPDATE usuarios SET nombre_visible = $1, actualizado_en = NOW() WHERE id = $2',
      [nombre, usuarioId],
    );

    await registrarAccion({
      usuarioId,
      modulo:      'perfil',
      accion:      'actualizar_nombre_visible',
      descripcion: `Usuario actualizó su nombre visible a: "${nombre}"`,
    }).catch(() => null);

    return await obtenerPerfil(usuarioId);
  } catch (error) {
    console.error('[Perfil] actualizarNombreVisible:', error);
    return { ok: false, error: 'Error al actualizar el nombre.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR FOTO (URL)
// Se espera que el cliente ya haya subido el archivo y tenga la URL pública.
// En esta versión se acepta base64 data-URL para almacenar avatar personalizado.
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarFotoPerfil(
  usuarioId: string,
  fotoUrl: string | null,
): Promise<ResultadoPerfil> {
  // Validar que sea una URL HTTP/HTTPS o data:image base64 o null (eliminar foto)
  if (fotoUrl !== null) {
    const esValida =
      fotoUrl.startsWith('http://') ||
      fotoUrl.startsWith('https://') ||
      fotoUrl.startsWith('data:image/');
    if (!esValida) return { ok: false, error: 'Formato de imagen no válido.' };
    if (fotoUrl.length > 500_000) return { ok: false, error: 'La imagen es demasiado grande. Usa una de menor tamaño.' };
  }

  try {
    await query(
      'UPDATE usuarios SET foto_url = $1, actualizado_en = NOW() WHERE id = $2',
      [fotoUrl, usuarioId],
    );

    await registrarAccion({
      usuarioId,
      modulo:      'perfil',
      accion:      fotoUrl ? 'actualizar_foto' : 'eliminar_foto',
      descripcion: fotoUrl ? 'Usuario actualizó su foto de perfil.' : 'Usuario eliminó su foto de perfil.',
    }).catch(() => null);

    return await obtenerPerfil(usuarioId);
  } catch (error) {
    console.error('[Perfil] actualizarFotoPerfil:', error);
    return { ok: false, error: 'Error al actualizar la foto.' };
  }
}
