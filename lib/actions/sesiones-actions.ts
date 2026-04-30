'use server';

/**
 * @fileoverview Server Actions para gestión de sesiones activas.
 * Usa la tabla sesiones_jwt ya existente para listar y cerrar sesiones remotamente.
 *
 * MODELO SIMPLIFICADO PARA ESCALA ADN:
 *   - Cada login inserta un registro en sesiones_jwt con un jti generado.
 *   - El jti se guarda en localStorage junto con la sesión del usuario.
 *   - Al listar sesiones, se muestran las activas del usuario.
 *   - Al cerrar remotamente, se marca activo=false y se registra cerrada_en.
 *   - La próxima validación de esa sesión la detectará como revocada.
 */

import { query } from '@/lib/db';
import { registrarAccion } from '@/lib/actions/auditoria-actions';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface SesionActiva {
  id: string;
  jti: string;
  ipOrigen: string | null;
  userAgent: string | null;
  nombreDispositivo: string | null;
  creadoEn: string;
  expiraEn: string;
  activo: boolean;
  esSesionActual: boolean;
}

export interface ResultadoSesiones {
  ok: boolean;
  datos: SesionActiva[];
  error?: string;
}

export interface ResultadoAccionSesion {
  ok: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSEAR USER AGENT A NOMBRE DE DISPOSITIVO LEGIBLE
// ─────────────────────────────────────────────────────────────────────────────

function parsearDispositivo(ua: string | null): string {
  if (!ua) return 'Dispositivo desconocido';
  const s = ua.toLowerCase();

  let navegador = 'Navegador';
  if (s.includes('edg/') || s.includes('edge/'))        navegador = 'Edge';
  else if (s.includes('chrome') && !s.includes('chromium')) navegador = 'Chrome';
  else if (s.includes('firefox'))                         navegador = 'Firefox';
  else if (s.includes('safari') && !s.includes('chrome')) navegador = 'Safari';
  else if (s.includes('opera') || s.includes('opr/'))    navegador = 'Opera';

  let so = 'desconocido';
  if (s.includes('windows'))       so = 'Windows';
  else if (s.includes('iphone'))   so = 'iPhone';
  else if (s.includes('ipad'))     so = 'iPad';
  else if (s.includes('android'))  so = 'Android';
  else if (s.includes('mac os'))   so = 'macOS';
  else if (s.includes('linux'))    so = 'Linux';

  return `${navegador} en ${so}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR SESIÓN AL LOGIN
// Llamar desde contexto-auth.tsx o auth-actions.ts tras login exitoso.
// ─────────────────────────────────────────────────────────────────────────────

export async function registrarSesion(params: {
  usuarioId: string;
  jti: string;
  userAgent?: string;
  ipOrigen?: string;
}): Promise<void> {
  try {
    const dispositivo = parsearDispositivo(params.userAgent ?? null);
    const expiraEn = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

    await query(
      `INSERT INTO sesiones_jwt
         (usuario_id, jti, ip_origen, user_agent, nombre_dispositivo, activo, expira_en)
       VALUES ($1, $2, $3::inet, $4, $5, TRUE, $6)
       ON CONFLICT (jti) DO NOTHING`,
      [
        params.usuarioId,
        params.jti,
        params.ipOrigen ?? null,
        params.userAgent ?? null,
        dispositivo,
        expiraEn.toISOString(),
      ],
    );
  } catch (error) {
    console.error('[Sesiones] registrarSesion:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR SESIONES ACTIVAS DEL USUARIO
// ─────────────────────────────────────────────────────────────────────────────

export async function listarSesionesActivas(
  usuarioId: string,
  jtiActual?: string,
): Promise<ResultadoSesiones> {
  try {
    const filas = await query<{
      id: string; jti: string; ip_origen: string | null;
      user_agent: string | null; nombre_dispositivo: string | null;
      creado_en: string; expira_en: string; activo: boolean;
    }>(
      `SELECT id, jti, ip_origen, user_agent, nombre_dispositivo, creado_en, expira_en, activo
         FROM sesiones_jwt
        WHERE usuario_id = $1
          AND activo = TRUE
          AND expira_en > NOW()
        ORDER BY creado_en DESC
        LIMIT 20`,
      [usuarioId],
    );

    return {
      ok: true,
      datos: filas.map(f => ({
        id:                f.id,
        jti:               f.jti,
        ipOrigen:          f.ip_origen,
        userAgent:         f.user_agent,
        nombreDispositivo: f.nombre_dispositivo ?? parsearDispositivo(f.user_agent),
        creadoEn:          f.creado_en,
        expiraEn:          f.expira_en,
        activo:            f.activo,
        esSesionActual:    jtiActual ? f.jti === jtiActual : false,
      })),
    };
  } catch (error) {
    console.error('[Sesiones] listarSesionesActivas:', error);
    return { ok: false, datos: [], error: 'Error al obtener sesiones.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CERRAR SESIÓN INDIVIDUAL (cierre remoto)
// ─────────────────────────────────────────────────────────────────────────────

export async function cerrarSesionRemota(
  sesionId: string,
  solicitadoPorId: string,
): Promise<ResultadoAccionSesion> {
  try {
    const [sesion] = await query<{ usuario_id: string; jti: string }>(
      'SELECT usuario_id, jti FROM sesiones_jwt WHERE id = $1 LIMIT 1',
      [sesionId],
    ).catch(() => [] as { usuario_id: string; jti: string }[]);

    if (!sesion) return { ok: false, error: 'Sesión no encontrada.' };

    await query(
      `UPDATE sesiones_jwt
          SET activo = FALSE, cerrada_en = NOW(), cerrada_por_usuario = TRUE
        WHERE id = $1`,
      [sesionId],
    );

    await registrarAccion({
      usuarioId:    solicitadoPorId,
      modulo:       'sesiones',
      accion:       'cerrar_sesion_remota',
      descripcion:  `Sesión cerrada remotamente. JTI: ${sesion.jti.slice(0, 12)}...`,
      referenciaId: sesionId,
    }).catch(() => null);

    return { ok: true };
  } catch (error) {
    console.error('[Sesiones] cerrarSesionRemota:', error);
    return { ok: false, error: 'Error al cerrar la sesión.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CERRAR TODAS LAS SESIONES EXCEPTO LA ACTUAL
// ─────────────────────────────────────────────────────────────────────────────

export async function cerrarTodasLasSesiones(
  usuarioId: string,
  jtiActual?: string,
): Promise<ResultadoAccionSesion> {
  try {
    await query(
      `UPDATE sesiones_jwt
          SET activo = FALSE, cerrada_en = NOW(), cerrada_por_usuario = TRUE
        WHERE usuario_id = $1
          AND activo = TRUE
          ${jtiActual ? 'AND jti != $2' : ''}`,
      jtiActual ? [usuarioId, jtiActual] : [usuarioId],
    );

    await registrarAccion({
      usuarioId,
      modulo:      'sesiones',
      accion:      'cerrar_todas_sesiones',
      descripcion: 'Usuario cerró todas sus sesiones remotas.',
    }).catch(() => null);

    return { ok: true };
  } catch (error) {
    console.error('[Sesiones] cerrarTodasLasSesiones:', error);
    return { ok: false, error: 'Error al cerrar las sesiones.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR SESIONES DE TODOS LOS USUARIOS (solo CEO/TI)
// ─────────────────────────────────────────────────────────────────────────────

export async function listarTodasLasSesiones(): Promise<{
  ok: boolean;
  datos: (SesionActiva & { nombreUsuario: string; correo: string; rol: string })[];
  error?: string;
}> {
  try {
    const filas = await query<{
      id: string; jti: string; ip_origen: string | null;
      user_agent: string | null; nombre_dispositivo: string | null;
      creado_en: string; expira_en: string; activo: boolean;
      nombre_completo: string; correo: string; rol_nombre: string;
    }>(
      `SELECT s.id, s.jti, s.ip_origen, s.user_agent, s.nombre_dispositivo,
              s.creado_en, s.expira_en, s.activo,
              u.nombre_completo, u.correo, r.nombre AS rol_nombre
         FROM sesiones_jwt s
         JOIN usuarios u ON u.id = s.usuario_id
         JOIN roles r ON r.id = u.rol_id
        WHERE s.activo = TRUE AND s.expira_en > NOW()
        ORDER BY s.creado_en DESC
        LIMIT 100`,
      [],
    );

    return {
      ok: true,
      datos: filas.map(f => ({
        id:                f.id,
        jti:               f.jti,
        ipOrigen:          f.ip_origen,
        userAgent:         f.user_agent,
        nombreDispositivo: f.nombre_dispositivo ?? parsearDispositivo(f.user_agent),
        creadoEn:          f.creado_en,
        expiraEn:          f.expira_en,
        activo:            f.activo,
        esSesionActual:    false,
        nombreUsuario:     f.nombre_completo,
        correo:            f.correo,
        rol:               f.rol_nombre,
      })),
    };
  } catch (error) {
    console.error('[Sesiones] listarTodasLasSesiones:', error);
    return { ok: false, datos: [], error: 'Error al obtener sesiones.' };
  }
}
