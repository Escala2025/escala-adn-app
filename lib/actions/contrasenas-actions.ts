'use server';

/**
 * @fileoverview Server Actions CRUD para la tabla `gestor_contrasenas`.
 *
 * REGLAS DE VISIBILIDAD:
 *   - CEO:           Ve todas las credenciales sin excepción.
 *   - TI:            Ve todas EXCEPTO las cuyo propietario tiene rol CEO.
 *   - Contable, Personal_base, Proveedor: Solo sus propias credenciales.
 */

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import type { Credencial, CategoriaCredencial, RolUsuario } from '@/lib/tipos';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

export interface ResultadoConDatos<T> extends ResultadoAccion {
  datos?: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ — visibilidad por rol
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerCredenciales(
  usuarioId: string,
  rol: RolUsuario,
): Promise<ResultadoConDatos<Credencial[]>> {
  // Roles que usan $1 con UUID — si el id no es UUID devolver vacío en vez de crashear
  const rolNecesitaUUID = rol !== 'CEO' && rol !== 'TI';
  if (rolNecesitaUUID && !UUID_REGEX.test(usuarioId)) {
    console.warn(`[Contrasenas] obtenerCredenciales: id inválido "${usuarioId}" — devolviendo lista vacía`);
    return { ok: true, datos: [] };
  }
  try {
    let sql: string;
    let params: unknown[];

    if (rol === 'CEO') {
      sql = `
        SELECT gc.id, gc.propietario_id AS usuario_id,
               u_prop.nombre_completo   AS persona_a_cargo,
               gc.nombre_plataforma, gc.link_plataforma,
               gc.contrasena_cifrada    AS contrasena,
               gc.categoria, gc.notas,
               gc.creado_en, gc.actualizado_en
        FROM gestor_contrasenas gc
        JOIN usuarios u_prop ON u_prop.id = gc.propietario_id
        WHERE gc.activo = TRUE
        ORDER BY gc.creado_en DESC`;
      params = [];
    } else if (rol === 'TI') {
      sql = `
        SELECT gc.id, gc.propietario_id AS usuario_id,
               u_prop.nombre_completo   AS persona_a_cargo,
               gc.nombre_plataforma, gc.link_plataforma,
               gc.contrasena_cifrada    AS contrasena,
               gc.categoria, gc.notas,
               gc.creado_en, gc.actualizado_en
        FROM gestor_contrasenas gc
        JOIN usuarios u_prop ON u_prop.id = gc.propietario_id
        JOIN roles    r_prop ON r_prop.id  = u_prop.rol_id
        WHERE gc.activo = TRUE
          AND r_prop.nombre != 'CEO'
        ORDER BY gc.creado_en DESC`;
      params = [];
    } else {
      sql = `
        SELECT gc.id, gc.propietario_id AS usuario_id,
               u_prop.nombre_completo   AS persona_a_cargo,
               gc.nombre_plataforma, gc.link_plataforma,
               gc.contrasena_cifrada    AS contrasena,
               gc.categoria, gc.notas,
               gc.creado_en, gc.actualizado_en
        FROM gestor_contrasenas gc
        JOIN usuarios u_prop ON u_prop.id = gc.propietario_id
        WHERE gc.activo = TRUE
          AND gc.propietario_id = $1
        ORDER BY gc.creado_en DESC`;
      params = [usuarioId];
    }

    type FilaCred = {
      id: string; usuario_id: string; persona_a_cargo: string;
      nombre_plataforma: string; link_plataforma: string | null;
      contrasena: string; categoria: string; notas: string | null;
      creado_en: string; actualizado_en: string;
    };

    const filas = await query<FilaCred>(sql, params);

    const credenciales: Credencial[] = filas.map(f => ({
      id:                 f.id,
      personaACargo:      f.persona_a_cargo,
      usuarioId:          f.usuario_id,
      nombrePlataforma:   f.nombre_plataforma,
      linkPlataforma:     f.link_plataforma ?? '',
      contrasena:         f.contrasena,
      categoria:          f.categoria as CategoriaCredencial,
      notas:              f.notas ?? undefined,
      fechaCreacion:      f.creado_en,
      fechaActualizacion: f.actualizado_en,
    }));

    return { ok: true, datos: credenciales };
  } catch (error) {
    console.error('[Contrasenas] obtenerCredenciales:', error);
    return { ok: false, error: 'No se pudo obtener las credenciales.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ: lista de usuarios para el selector del formulario
// ─────────────────────────────────────────────────────────────────────────────

export interface UsuarioSelectItem {
  id:             string;
  nombreCompleto: string;
  cargo:          string;
}

export async function obtenerUsuariosParaSelect(): Promise<ResultadoConDatos<UsuarioSelectItem[]>> {
  try {
    const filas = await query<{ id: string; nombre_completo: string; cargo: string | null }>(
      `SELECT u.id, u.nombre_completo, u.cargo
       FROM usuarios u
       WHERE u.activo = TRUE
       ORDER BY u.nombre_completo ASC`,
    );
    const datos: UsuarioSelectItem[] = filas.map(f => ({
      id:             f.id,
      nombreCompleto: f.nombre_completo,
      cargo:          f.cargo ?? '',
    }));
    return { ok: true, datos };
  } catch (error) {
    console.error('[Contrasenas] obtenerUsuariosParaSelect:', error);
    return { ok: false, error: 'No se pudo obtener los usuarios.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosCrearCredencial {
  propietarioId:    string;
  personaACargo:    string;
  nombrePlataforma: string;
  linkPlataforma?:  string;
  contrasena:       string;
  categoria:        CategoriaCredencial;
  notas?:           string;
}

export async function crearCredencial(
  datos: DatosCrearCredencial,
): Promise<ResultadoConDatos<Credencial>> {
  try {
    const link = datos.linkPlataforma?.trim() || null;
    if (link && !/^https?:\/\//i.test(link)) {
      return { ok: false, error: 'El link debe comenzar con http:// o https://' };
    }

    const filas = await query<{ id: string; creado_en: string; actualizado_en: string }>(
      `INSERT INTO gestor_contrasenas
         (usuario_id, propietario_id, nombre_plataforma, link_plataforma,
          contrasena_cifrada, categoria, notas, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
       RETURNING id, creado_en, actualizado_en`,
      [
        datos.propietarioId,  // usuario_id = propietario (quien es dueño de la cred)
        datos.propietarioId,
        datos.nombrePlataforma,
        link,
        datos.contrasena,     // TODO: cifrar AES-256 en producción
        datos.categoria,
        datos.notas ?? null,
      ],
    );

    const nueva: Credencial = {
      id:                 filas[0].id,
      personaACargo:      datos.personaACargo,
      usuarioId:          datos.propietarioId,
      nombrePlataforma:   datos.nombrePlataforma,
      linkPlataforma:     link ?? '',
      contrasena:         datos.contrasena,
      categoria:          datos.categoria,
      notas:              datos.notas,
      fechaCreacion:      filas[0].creado_en,
      fechaActualizacion: filas[0].actualizado_en,
    };

    revalidatePath('/');
    return { ok: true, datos: nueva };
  } catch (error) {
    console.error('[Contrasenas] crearCredencial:', error);
    return { ok: false, error: 'No se pudo guardar la credencial.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosActualizarCredencial {
  id:               string;
  propietarioId:    string;
  personaACargo:    string;
  nombrePlataforma: string;
  linkPlataforma?:  string;
  contrasena:       string;
  categoria:        CategoriaCredencial;
  notas?:           string;
}

export async function actualizarCredencial(
  datos: DatosActualizarCredencial,
): Promise<ResultadoAccion> {
  try {
    const link = datos.linkPlataforma?.trim() || null;
    await query(
      `UPDATE gestor_contrasenas SET
         propietario_id     = $1,
         nombre_plataforma  = $2,
         link_plataforma    = $3,
         contrasena_cifrada = $4,
         categoria          = $5,
         notas              = $6,
         actualizado_en     = NOW()
       WHERE id = $7`,
      [
        datos.propietarioId,
        datos.nombrePlataforma,
        link,
        datos.contrasena,
        datos.categoria,
        datos.notas ?? null,
        datos.id,
      ],
    );
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Contrasenas] actualizarCredencial:', error);
    return { ok: false, error: 'No se pudo actualizar la credencial.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarCredencial(id: string): Promise<ResultadoAccion> {
  try {
    await query(
      'UPDATE gestor_contrasenas SET activo=FALSE, actualizado_en=NOW() WHERE id=$1',
      [id],
    );
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('[Contrasenas] eliminarCredencial:', error);
    return { ok: false, error: 'No se pudo eliminar la credencial.' };
  }
}
