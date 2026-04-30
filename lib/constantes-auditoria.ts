/**
 * Constantes compartidas para el módulo de auditoría.
 * Este archivo NO tiene "use server" para poder usarse en componentes cliente.
 */

export const MODULOS_AUDITORIA = [
  { valor: '',            etiqueta: 'Todos los módulos'   },
  { valor: 'auth',        etiqueta: 'Autenticación'       },
  { valor: 'cobros',      etiqueta: 'Cuentas de Cobro'    },
  { valor: 'credenciales',etiqueta: 'Gestor de Contraseñas'},
  { valor: 'usuarios',    etiqueta: 'Usuarios'            },
  { valor: 'proveedores', etiqueta: 'Proveedores'         },
  { valor: 'bitacora',    etiqueta: 'Bitácora'            },
  { valor: 'perfil',      etiqueta: 'Perfil'              },
  { valor: 'sesiones',    etiqueta: 'Sesiones'            },
];
