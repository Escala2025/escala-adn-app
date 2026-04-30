'use server';

/**
 * @fileoverview Server Actions de autenticación.
 * Valida credenciales contra la tabla `usuarios` de PostgreSQL.
 * Las contraseñas se comparan con bcryptjs (nueva arquitectura Node.js).
 *
 * NOTA DE MIGRACIÓN:
 *   El seed original en la BD usa Argon2id (PHP). Ejecuta el script
 *   `scripts/migrate-seed-hash.mjs` una sola vez para convertir el
 *   hash del usuario inicial a bcrypt compatible con Node.js.
 */

import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import type { Usuario, RolUsuario } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

interface FilaUsuarioDB {
  id: string;
  nombre_completo: string;
  correo: string;
  telefono: string | null;
  cargo: string | null;
  rol_nombre: string;
  hash_contrasena: string;
  activo: boolean;
  creado_en: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCIÓN: INGRESAR
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoIngreso {
  ok: boolean;
  usuario?: Usuario;
  error?: string;
}

/**
 * Autentica un usuario contra la base de datos PostgreSQL.
 * Devuelve el objeto Usuario (sin hash) si las credenciales son válidas.
 */
export async function ingresarAction(
  correo: string,
  contrasena: string,
): Promise<ResultadoIngreso> {
  if (!correo || !contrasena) {
    return { ok: false, error: 'Correo y contraseña son requeridos.' };
  }

  try {
    // Obtener usuario con JOIN a roles para recuperar el nombre del rol
    const filas = await query<FilaUsuarioDB>(
      `SELECT
         u.id,
         u.nombre_completo,
         u.correo,
         u.telefono,
         u.cargo,
         r.nombre   AS rol_nombre,
         u.hash_contrasena,
         u.activo,
         u.creado_en
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE LOWER(u.correo) = LOWER($1)
       LIMIT 1`,
      [correo.trim()],
    );

    if (filas.length === 0) {
      return { ok: false, error: 'Credenciales incorrectas o usuario inactivo.' };
    }

    const fila = filas[0];

    if (!fila.activo) {
      return { ok: false, error: 'Credenciales incorrectas o usuario inactivo.' };
    }

    // Comparar contraseña con el hash almacenado
    const esValida = await bcrypt.compare(contrasena, fila.hash_contrasena);

    if (!esValida) {
      return { ok: false, error: 'Credenciales incorrectas o usuario inactivo.' };
    }

    // Actualizar último acceso (no bloqueante)
    query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
      [fila.id],
    ).catch(() => {/* no crítico */});

    const usuario: Usuario = {
      id:             fila.id,
      nombreCompleto: fila.nombre_completo,
      correo:         fila.correo,
      telefono:       fila.telefono ?? '',
      cargo:          fila.cargo ?? '',
      rol:            fila.rol_nombre as RolUsuario,
      activo:         fila.activo,
      fechaCreacion:  fila.creado_en,
    };

    return { ok: true, usuario };
  } catch (error) {
    console.error('[Auth] Error en ingresarAction:', error);
    return {
      ok: false,
      error: 'Error de conexión con la base de datos. Verifica que PostgreSQL esté corriendo.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Hash de nueva contraseña
// Usado al crear o actualizar usuarios desde los módulos.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un hash bcrypt (cost=12) de una contraseña en texto plano.
 * Solo se debe llamar desde Server Actions (no exponer al cliente).
 */
export async function hashContrasena(contrasenaPlana: string): Promise<string> {
  return bcrypt.hash(contrasenaPlana, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCIÓN: VERIFICAR SESIÓN ACTIVA
// Comprueba que un usuario_id guardado en localStorage aún existe y está activo
// en la BD. Devuelve false si el UUID no existe (sesión de otro entorno de BD).
// ─────────────────────────────────────────────────────────────────────────────

export async function verificarSesionActiva(usuarioId: string): Promise<boolean> {
  if (!usuarioId) return false;
  const esUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuarioId);
  if (!esUUID) return false;

  try {
    const filas = await query<{ activo: boolean }>(
      'SELECT activo FROM usuarios WHERE id = $1 LIMIT 1',
      [usuarioId],
    );
    return filas.length > 0 && filas[0].activo === true;
  } catch {
    // Si la BD no está disponible, permitir la sesión (no forzar logout)
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCIÓN: CAMBIAR CONTRASEÑA PROPIA
// Verifica la contraseña actual con bcrypt antes de permitir el cambio.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoCambioContrasena {
  ok: boolean;
  error?: string;
}

/**
 * Verifica la contraseña actual del usuario y la actualiza si es válida.
 * No requiere rol especial — cualquier usuario puede cambiar la suya propia.
 */
export async function verificarYCambiarContrasena(
  usuarioId: string,
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<ResultadoCambioContrasena> {
  if (!contrasenaActual || !contrasenaNueva) {
    return { ok: false, error: 'Ambas contraseñas son requeridas.' };
  }
  if (contrasenaNueva.length < 8) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  try {
    // Obtener hash actual del usuario
    const filas = await query<{ hash_contrasena: string }>(
      'SELECT hash_contrasena FROM usuarios WHERE id = $1',
      [usuarioId],
    );
    if (filas.length === 0) {
      return { ok: false, error: 'Usuario no encontrado.' };
    }

    // Verificar contraseña actual con bcrypt
    const esValida = await bcrypt.compare(contrasenaActual, filas[0].hash_contrasena);
    if (!esValida) {
      return { ok: false, error: 'La contraseña actual no es correcta.' };
    }

    // Generar nuevo hash y actualizar
    const nuevoHash = await hashContrasena(contrasenaNueva);
    await query(
      'UPDATE usuarios SET hash_contrasena = $1, actualizado_en = NOW() WHERE id = $2',
      [nuevoHash, usuarioId],
    );

    return { ok: true };
  } catch (error) {
    console.error('[Auth] verificarYCambiarContrasena:', error);
    return { ok: false, error: 'Error al actualizar la contraseña.' };
  }
}
