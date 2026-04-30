/**
 * @fileoverview Contexto global de autenticación para Escala ADN.
 * Valida credenciales contra la tabla `usuarios` de PostgreSQL mediante
 * la Server Action `ingresarAction`. La sesión se persiste en localStorage.
 *
 * Patrón: React Context + useReducer para gestión predecible de estado.
 */

'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { Usuario, RolUsuario } from './tipos';
import { ingresarAction } from '@/lib/actions/auth-actions';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DEL CONTEXTO
// ─────────────────────────────────────────────────────────────────────────────

interface EstadoAuth {
  usuario: Usuario | null;
  autenticado: boolean;
  cargando: boolean;
  error: string | null;
}

type AccionAuth =
  | { tipo: 'INICIAR_CARGA' }
  | { tipo: 'INGRESO_EXITOSO'; payload: Usuario }
  | { tipo: 'INGRESO_FALLIDO'; payload: string }
  | { tipo: 'CERRAR_SESION' }
  | { tipo: 'LIMPIAR_ERROR' };

interface ContextoAuthValor extends EstadoAuth {
  ingresar: (correo: string, contrasena: string) => Promise<void>;
  cerrarSesion: () => void;
  limpiarError: () => void;
  tieneRol: (roles: RolUsuario[]) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

const estadoInicial: EstadoAuth = {
  usuario: null,
  autenticado: false,
  cargando: false,
  error: null,
};

function reductorAuth(estado: EstadoAuth, accion: AccionAuth): EstadoAuth {
  switch (accion.tipo) {
    case 'INICIAR_CARGA':
      return { ...estado, cargando: true, error: null };

    case 'INGRESO_EXITOSO':
      return {
        usuario: accion.payload,
        autenticado: true,
        cargando: false,
        error: null,
      };

    case 'INGRESO_FALLIDO':
      return { ...estado, cargando: false, error: accion.payload };

    case 'CERRAR_SESION':
      return { ...estadoInicial };

    case 'LIMPIAR_ERROR':
      return { ...estado, error: null };

    default:
      return estado;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO
// ─────────────────────────────────────────────────────────────────────────────

const ContextoAuth = createContext<ContextoAuthValor | null>(null);

/**
 * Proveedor de autenticación.
 * Envuelve toda la aplicación para exponer el contexto de sesión.
 */
export function ProveedorAuth({ children }: { children: React.ReactNode }) {
  const [estado, despachar] = useReducer(reductorAuth, estadoInicial);

  /** Restaura la sesión desde localStorage al recargar la página. */
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('escala_sesion');
    if (!sesionGuardada) return;

    try {
      const usuario: Usuario = JSON.parse(sesionGuardada);

      // Validar formato UUID — descartar sesiones con IDs mock antiguos
      const esUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuario.id);
      if (!esUUID || !usuario.correo || !usuario.rol) {
        localStorage.removeItem('escala_sesion');
        return;
      }

      // Verificar contra la BD que el usuario sigue existiendo y activo
      // Re-autenticar silenciosamente: si el UUID no existe en la BD se fuerza re-login
      import('@/lib/actions/auth-actions').then(({ verificarSesionActiva }) => {
        if (!verificarSesionActiva) {
          // Fallback: confiar en la sesión guardada si la función no existe aún
          despachar({ tipo: 'INGRESO_EXITOSO', payload: usuario });
          return;
        }
        verificarSesionActiva(usuario.id).then(valida => {
          if (valida) {
            despachar({ tipo: 'INGRESO_EXITOSO', payload: usuario });
          } else {
            localStorage.removeItem('escala_sesion');
          }
        }).catch(() => {
          // Si la BD no responde, confiar en la sesión local
          despachar({ tipo: 'INGRESO_EXITOSO', payload: usuario });
        });
      });
    } catch {
      localStorage.removeItem('escala_sesion');
    }
  }, []);

  /**
   * Autentica al usuario llamando a la Server Action `ingresarAction`.
   * La contraseña se verifica contra el hash bcrypt almacenado en PostgreSQL.
   */
  const ingresar = useCallback(async (correo: string, contrasena: string): Promise<void> => {
    despachar({ tipo: 'INICIAR_CARGA' });

    try {
      const resultado = await ingresarAction(correo, contrasena);

      if (resultado.ok && resultado.usuario) {
        localStorage.setItem('escala_sesion', JSON.stringify(resultado.usuario));
        despachar({ tipo: 'INGRESO_EXITOSO', payload: resultado.usuario });
      } else {
        despachar({
          tipo: 'INGRESO_FALLIDO',
          payload: resultado.error ?? 'Credenciales incorrectas o usuario inactivo.',
        });
      }
    } catch {
      despachar({
        tipo: 'INGRESO_FALLIDO',
        payload: 'Error de conexión. Verifica que la base de datos esté disponible.',
      });
    }
  }, []);

  /** Cierra la sesión y limpia el almacenamiento local. */
  const cerrarSesion = useCallback(() => {
    localStorage.removeItem('escala_sesion');
    despachar({ tipo: 'CERRAR_SESION' });
  }, []);

  /** Limpia el mensaje de error del estado. */
  const limpiarError = useCallback(() => {
    despachar({ tipo: 'LIMPIAR_ERROR' });
  }, []);

  /**
   * Verifica si el usuario activo tiene alguno de los roles especificados.
   */
  const tieneRol = useCallback((roles: RolUsuario[]): boolean => {
    if (!estado.usuario) return false;
    return roles.includes(estado.usuario.rol);
  }, [estado.usuario]);

  const valor: ContextoAuthValor = {
    ...estado,
    ingresar,
    cerrarSesion,
    limpiarError,
    tieneRol,
  };

  return (
    <ContextoAuth.Provider value={valor}>
      {children}
    </ContextoAuth.Provider>
  );
}

/**
 * Hook para consumir el contexto de autenticación.
 * Lanza un error si se usa fuera del ProveedorAuth.
 */
export function useAuth(): ContextoAuthValor {
  const contexto = useContext(ContextoAuth);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <ProveedorAuth>.');
  }
  return contexto;
}
