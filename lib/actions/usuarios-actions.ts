'use server';

/**
 * @fileoverview Server Actions CRUD para la tabla `usuarios`.
 * Todos los handlers usan `revalidatePath` para sincronizar la UI
 * automáticamente después de cada mutación.
 */

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { hashContrasena } from '@/lib/actions/auth-actions';
import type { Usuario, RolUsuario } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

export interface ResultadoConDatos<T> extends ResultadoAccion {
  datos?: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna todos los usuarios con su nombre de rol resuelto (JOIN con roles).
 */
export async function obtenerUsuarios(): Promise<ResultadoConDatos<Usuario[]>> {
  try {
    const filas = await query<{
      id: string;
      nombre_completo: string;
      correo: string;
      telefono: string | null;
      cargo: string | null;
      rol_nombre: string;
      activo: boolean;
      creado_en: string;
    }>(
      `SELECT
         u.id,
         u.nombre_completo,
         u.correo,
         u.telefono,
         u.cargo,
         r.nombre   AS rol_nombre,
         u.activo,
         u.creado_en
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       ORDER BY u.creado_en ASC`,
    );

    const usuarios: Usuario[] = filas.map(f => ({
      id:             f.id,
      nombreCompleto: f.nombre_completo,
      correo:         f.correo,
      telefono:       f.telefono ?? '',
      cargo:          f.cargo ?? '',
      rol:            f.rol_nombre as RolUsuario,
      activo:         f.activo,
      fechaCreacion:  f.creado_en,
    }));

    return { ok: true, datos: usuarios };
  } catch (error) {
    console.error('[Usuarios] obtenerUsuarios:', error);
    return { ok: false, error: 'No se pudo obtener la lista de usuarios.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosCrearUsuario {
  nombreCompleto: string;
  correo:         string;
  telefono?:      string;
  cargo?:         string;
  rol:            RolUsuario;
  contrasena:     string;
}

/**
 * Crea un nuevo usuario. Resuelve el rol_id buscando en la tabla `roles`.
 */
export async function crearUsuario(
  datos: DatosCrearUsuario,
): Promise<ResultadoConDatos<Usuario>> {
  try {
    // Resolver rol_id
    const roles = await query<{ id: number }>(
      'SELECT id FROM roles WHERE nombre = $1',
      [datos.rol],
    );
    if (roles.length === 0) {
      return { ok: false, error: `Rol '${datos.rol}' no encontrado en la base de datos.` };
    }
    const rolId = roles[0].id;

    // Hash de contraseña
    const hash = await hashContrasena(datos.contrasena);

    // Insertar usuario
    const filas = await query<{ id: string; creado_en: string }>(
      `INSERT INTO usuarios
         (rol_id, nombre_completo, correo, telefono, cargo, hash_contrasena, activo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, creado_en`,
      [rolId, datos.nombreCompleto, datos.correo, datos.telefono ?? null, datos.cargo ?? null, hash],
    );

    const nuevo: Usuario = {
      id:             filas[0].id,
      nombreCompleto: datos.nombreCompleto,
      correo:         datos.correo,
      telefono:       datos.telefono ?? '',
      cargo:          datos.cargo ?? '',
      rol:            datos.rol,
      activo:         true,
      fechaCreacion:  filas[0].creado_en,
    };

    revalidatePath('/');
    return { ok: true, datos: nuevo };
  } catch (error: unknown) {
    console.error('[Usuarios] crearUsuario:', error);
    const msg = String(error);
    if (msg.includes('unique') || msg.includes('correo')) {
      return { ok: false, error: 'Ya existe un usuario con ese correo electrónico.' };
    }
    return { ok: false, error: 'No se pudo crear el usuario.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosActualizarUsuario {
  nombreCompleto: string;
  correo:         string;
  telefono?:      string;
  cargo?:         string;
  rol:            RolUsuario;
  activo?:        boolean;
  nuevaContrasena?: string;
}

/**
 * Actualiza los datos de un usuario existente.
 * @param id    UUID del usuario a actualizar.
 * @param datos Campos a modificar.
 */
export async function actualizarUsuario(
  id: string,
  datos: DatosActualizarUsuario,
): Promise<ResultadoAccion> {
  try {
    const roles = await query<{ id: number }>(
      'SELECT id FROM roles WHERE nombre = $1',
      [datos.rol],
    );
    if (roles.length === 0) return { ok: false, error: `Rol '${datos.rol}' no encontrado.` };
    const rolId = roles[0].id;

    if (datos.nuevaContrasena) {
      const hash = await hashContrasena(datos.nuevaContrasena);
      await query(
        `UPDATE usuarios
         SET nombre_completo=$1, correo=$2, telefono=$3, cargo=$4, rol_id=$5,
             hash_contrasena=$6, activo=COALESCE($7, activo), actualizado_en=NOW()
         WHERE id=$8`,
        [datos.nombreCompleto, datos.correo, datos.telefono ?? null, datos.cargo ?? null,
         rolId, hash, datos.activo ?? null, id],
      );
    } else {
      await query(
        `UPDATE usuarios
         SET nombre_completo=$1, correo=$2, telefono=$3, cargo=$4, rol_id=$5,
             activo=COALESCE($6, activo), actualizado_en=NOW()
         WHERE id=$7`,
        [datos.nombreCompleto, datos.correo, datos.telefono ?? null, datos.cargo ?? null,
         rolId, datos.activo ?? null, id],
      );
    }

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Usuarios] actualizarUsuario:', error);
    return { ok: false, error: 'No se pudo actualizar el usuario.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina permanentemente un usuario y todos sus registros dependientes
 * (credenciales del gestor de contraseñas asociadas a él).
 * No se puede deshacer — usar solo desde el panel de administración CEO/TI.
 */
export async function eliminarUsuario(id: string): Promise<ResultadoAccion> {
  try {
    // Eliminar credenciales del gestor asociadas al usuario (propietario)
    await query(
      'UPDATE gestor_contrasenas SET activo = FALSE WHERE propietario_id = $1',
      [id],
    );
    // Eliminar el usuario
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Usuarios] eliminarUsuario:', error);
    return { ok: false, error: 'No se pudo eliminar el usuario.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE ESTADO (activar / desactivar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activa o desactiva un usuario por su ID.
 */
export async function toggleEstadoUsuario(
  id: string,
  activo: boolean,
): Promise<ResultadoAccion> {
  try {
    await query(
      'UPDATE usuarios SET activo=$1, actualizado_en=NOW() WHERE id=$2',
      [activo, id],
    );
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Usuarios] toggleEstadoUsuario:', error);
    return { ok: false, error: 'No se pudo cambiar el estado del usuario.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ: lista simple para selects (sin hash)
// ─────────────────────────────────────────────────────────────────────────────

export interface UsuarioSimple {
  id:             string;
  nombreCompleto: string;
  cargo:          string;
  rol:            RolUsuario;
}

/**
 * Lista ligera de usuarios para poblar dropdowns (ej: seleccionar responsable en contraseñas).
 */
export async function obtenerUsuariosSimple(): Promise<UsuarioSimple[]> {
  try {
    const filas = await query<{ id: string; nombre_completo: string; cargo: string | null; rol_nombre: string }>(
      `SELECT u.id, u.nombre_completo, u.cargo, r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.activo = TRUE
       ORDER BY u.nombre_completo ASC`,
    );
    return filas.map(f => ({
      id:             f.id,
      nombreCompleto: f.nombre_completo,
      cargo:          f.cargo ?? '',
      rol:            f.rol_nombre as RolUsuario,
    }));
  } catch {
    return [];
  }
}
