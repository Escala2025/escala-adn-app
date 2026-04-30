/**
 * @fileoverview Funciones utilitarias puras de la aplicación Escala ADN.
 * Sin efectos secundarios ni dependencias de frameworks externos.
 */

import type { RolUsuario, EstadoCuentaCobro, Credencial, Usuario } from './tipos';

// ─────────────────────────────────────────────────────────────────────────────
// FORMATEO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda colombiana (COP).
 * @param valor - Número a formatear.
 * @returns Cadena formateada, ej: "$ 1.250.000".
 */
export function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

/**
 * Formatea una fecha ISO a formato legible en español.
 * @param fechaIso - Cadena de fecha ISO 8601.
 * @returns Fecha formateada, ej: "15 de enero de 2025".
 */
export function formatearFecha(fechaIso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(fechaIso));
}

/**
 * Formatea una fecha ISO a DD/MM/YYYY.
 */
export function formatearFechaCorta(fechaIso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(fechaIso));
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISOS
// ─────────────────────────────────────────────────────────────────────────────

/** Roles con privilegios de administración total. */
export const ROLES_ADMINISTRADOR: RolUsuario[] = ['CEO', 'TI', 'Contable'];

/** Roles con acceso restringido. */
export const ROLES_BASE: RolUsuario[] = ['Personal_base', 'Proveedor'];

/**
 * REGLAS DE VISIBILIDAD DE LA BÓVEDA DE CONTRASEÑAS:
 *
 * - CEO      → Ve todas las contraseñas de todos los usuarios sin excepción.
 * - TI       → Ve todas las contraseñas EXCEPTO las que pertenecen a usuarios con rol CEO.
 * - Contable, Personal_base, Proveedor → Solo ven sus propias contraseñas.
 *
 * Esta función determina si un rol tiene algún nivel de privilegio elevado en la bóveda.
 * Para la lógica de exclusión de CEO, usar `filtrarCredencialesPorRol()`.
 */
export function esAdminContrasenas(rol: RolUsuario): boolean {
  // CEO y TI tienen acceso ampliado (con distintas restricciones)
  return rol === 'CEO' || rol === 'TI';
}

/**
 * Aplica las reglas estrictas de visibilidad de la bóveda de contraseñas.
 *
 * Regla de negocio:
 *  - CEO      → Acceso total sin restricciones.
 *  - TI       → Ve todas las credenciales, excepto las de usuarios con rol CEO.
 *  - Demás    → Solo sus propias credenciales (filtradas por usuarioId).
 *
 * @param credenciales - Lista completa de credenciales almacenadas.
 * @param usuarioActual - Usuario autenticado que realiza la consulta.
 * @param todosLosUsuarios - Lista de todos los usuarios para resolver el rol del propietario.
 * @returns Subconjunto de credenciales que el usuario tiene derecho a ver.
 */
export function filtrarCredencialesPorRol(
  credenciales: Credencial[],
  usuarioActual: Usuario,
  todosLosUsuarios: Usuario[],
): Credencial[] {
  const rol = usuarioActual.rol;

  // CEO ve todo sin excepción
  if (rol === 'CEO') {
    return credenciales;
  }

  // TI ve todo excepto las credenciales cuyo propietario tiene rol CEO
  if (rol === 'TI') {
    return credenciales.filter((cred) => {
      const propietario = todosLosUsuarios.find((u) => u.id === cred.usuarioId);
      // Si el propietario es CEO, TI NO puede verla
      return propietario?.rol !== 'CEO';
    });
  }

  // Todos los demás roles: solo sus propias credenciales
  return credenciales.filter((cred) => cred.usuarioId === usuarioActual.id);
}

/**
 * Verifica si el rol puede gestionar usuarios.
 */
export function puedeGestionarUsuarios(rol: RolUsuario): boolean {
  return rol === 'CEO' || rol === 'TI';
}

/**
 * Verifica si el rol tiene acceso al tablero contable.
 */
export function esContador(rol: RolUsuario): boolean {
  return rol === 'Contable' || rol === 'CEO' || rol === 'TI';
}

/**
 * Devuelve la etiqueta visual de un rol.
 */
export function etiquetaRol(rol: RolUsuario): string {
  const mapa: Record<RolUsuario, string> = {
    CEO: 'CEO',
    TI: 'Tecnología',
    Contable: 'Contable',
    Personal_base: 'Personal Base',
    Proveedor: 'Proveedor',
  };
  return mapa[rol] ?? rol;
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la clase CSS para un badge de estado de cuenta de cobro.
 */
export function claseEstadoCuenta(estado: EstadoCuentaCobro): string {
  const mapa: Record<EstadoCuentaCobro, string> = {
    Pendiente:     'insignia-pendiente',
    'En revisión': 'insignia-revision',
    Autorizado:    'insignia-autorizado',
    Rechazado:     'insignia-rechazado',
    // "Pagada" usa verde sólido para diferenciarse de "Autorizado" (verde claro)
    Pagada:        'insignia-pagada',
  };
  return mapa[estado] ?? 'insignia-pendiente';
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADORES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un ID único basado en timestamp y aleatoriedad.
 * En producción se reemplaza por UUID del backend.
 */
export function generarId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Genera una contraseña segura aleatoria.
 * @param longitud - Longitud de la contraseña (default: 16).
 */
export function generarContrasena(longitud = 16): string {
  const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const numeros    = '0123456789';
  const especiales = '@#$%^&*!_-';
  const todos      = mayusculas + minusculas + numeros + especiales;

  const obtenerCaracter = (fuente: string) =>
    fuente[Math.floor(Math.random() * fuente.length)];

  // Garantizar al menos un carácter de cada tipo
  const base = [
    obtenerCaracter(mayusculas),
    obtenerCaracter(minusculas),
    obtenerCaracter(numeros),
    obtenerCaracter(especiales),
  ];

  const resto = Array.from({ length: longitud - 4 }, () =>
    obtenerCaracter(todos),
  );

  return [...base, ...resto]
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Convierte un número a su representación en letras (español colombiano).
 * Soporta hasta 999.999.999.
 */
export function numeroALetras(numero: number): string {
  if (numero === 0) return 'CERO';

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const convertirMenorMil = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    if (n < 20) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
    }
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return resto === 0 ? centenas[c] : `${centenas[c]} ${convertirMenorMil(resto)}`;
  };

  let resultado = '';
  const millones = Math.floor(numero / 1_000_000);
  const miles    = Math.floor((numero % 1_000_000) / 1_000);
  const resto    = numero % 1_000;

  if (millones > 0) {
    resultado += millones === 1 ? 'UN MILLÓN ' : `${convertirMenorMil(millones)} MILLONES `;
  }
  if (miles > 0) {
    resultado += miles === 1 ? 'MIL ' : `${convertirMenorMil(miles)} MIL `;
  }
  if (resto > 0) {
    resultado += convertirMenorMil(resto);
  }

  return resultado.trim() + ' PESOS M/L';
}

/**
 * Trunca un texto a una longitud máxima con elipsis.
 */
export function truncarTexto(texto: string, maxLen: number): string {
  return texto.length > maxLen ? `${texto.slice(0, maxLen)}…` : texto;
}
