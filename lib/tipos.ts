/**
 * @fileoverview Definición centralizada de tipos e interfaces TypeScript.
 * Toda la aplicación Escala ADN consume estos contratos de datos.
 * Seguimos el principio de Interface Segregation (SOLID).
 */

// ─────────────────────────────────────────────────────────────────────────────
// AUTENTICACIÓN Y USUARIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles disponibles en la plataforma.
 * Determina qué módulos y acciones puede realizar cada usuario.
 */
export type RolUsuario = 'CEO' | 'TI' | 'Contable' | 'Personal_base' | 'Proveedor';

/**
 * Entidad principal de usuario autenticado.
 */
export interface Usuario {
  id: string;
  nombreCompleto: string;
  correo: string;
  /**
   * Solo presente en el contexto local de sesión del cliente.
   * Nunca se expone desde el servidor — se deja en blanco ("") al mapear desde BD.
   */
  contrasenaAcceso?: string;
  telefono: string;
  cargo: string;
  rol: RolUsuario;
  activo: boolean;
  fechaCreacion?: string;
  /** Nombre corto/alias que el usuario prefiere mostrar. Si es null se usa nombreCompleto. */
  nombreVisible?: string;
  /** URL de avatar personalizado. Si es null se usan iniciales como fallback. */
  fotoUrl?: string;
}

/**
 * Credenciales enviadas al endpoint de autenticación.
 */
export interface CredencialesIngreso {
  correo: string;
  contrasena: string;
}

/**
 * Respuesta del servidor al autenticar exitosamente.
 */
export interface RespuestaAutenticacion {
  token: string;
  usuario: Usuario;
  expiracion: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GESTOR DE CONTRASEÑAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Categorías disponibles para clasificar credenciales almacenadas.
 */
export type CategoriaCredencial =
  | 'Redes Sociales'
  | 'Herramientas de Diseño'
  | 'Servidores'
  | 'Email'
  | 'CRM'
  | 'Contabilidad'
  | 'Almacenamiento'
  | 'Otros';

/**
 * Entidad de credencial almacenada en el gestor interno.
 */
export interface Credencial {
  id: string;
  personaACargo: string;
  usuarioId: string;
  nombrePlataforma: string;
  linkPlataforma: string;
  contrasena: string;
  categoria: CategoriaCredencial;
  notas?: string;
  fechaCreacion: string;
  fechaActualizacion?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDORES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regímenes tributarios disponibles en Colombia.
 */
export type RegimenTributario = 'Responsable de IVA' | 'No Responsable de IVA' | 'Gran Contribuyente' | 'Régimen Simple';

/**
 * Datos maestros de un proveedor registrado.
 */
export interface Proveedor {
  id: string;
  razonSocial: string;
  nitCedula: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  correo?: string;
  regimen?: RegimenTributario;
  responsabilidadesFiscales?: string;
  servicios?: string;
  activo: boolean;
  fechaCreacion?: string;
}

/**
 * Registro de un pago realizado a un proveedor.
 */
export interface TransaccionProveedor {
  id: string;
  proveedorId: string;
  fecha: string;
  hora?: string;
  valor: number;
  concepto: string;
  numeroComprobante?: string;
  soportePagoUrl?: string;
  /** Nombre del usuario que registró (solo para mostrar en UI) */
  registradoPor?: string;
  /** UUID del usuario que registró (para guardar en BD) */
  registradoPorId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUENTAS DE COBRO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de cuenta bancaria disponibles.
 */
export type TipoCuentaBancaria = 'Ahorros' | 'Corriente';

/**
 * Estados del ciclo de vida de una cuenta de cobro.
 */
/**
 * Estados posibles de una cuenta de cobro.
 * Flujo canónico: Pendiente → En revisión → Autorizado → Pagada
 * Flujo de rechazo: cualquier estado → Rechazado
 * La transición a "Pagada" es exclusiva de roles CEO y Contable.
 */
export type EstadoCuentaCobro = 'Pendiente' | 'En revisión' | 'Autorizado' | 'Rechazado' | 'Pagada';

/**
 * Datos bancarios adjuntos a una cuenta de cobro.
 */
export interface DatosBancarios {
  tipoCuenta: TipoCuentaBancaria;
  banco: string;
  numeroCuenta: string;
  titular: string;
}

/**
 * Entidad completa de una cuenta de cobro generada por un usuario o proveedor.
 */
export interface CuentaCobro {
  id: string;
  numeroCuenta: string;
  usuarioId: string;
  nombreSolicitante: string;
  cedulaSolicitante: string;
  valorNumerico: number;
  valorLetras: string;
  concepto: string;
  centroCostos: string;
  declaranteRenta: boolean;
  tomaCostosDeducciones: boolean;
  datosBancarios: DatosBancarios;
  firmaSvg?: string;
  fechaDocumento: string;

  /** URLs de archivos almacenados en Google Drive */
  urlCuentaCobro?: string;
  urlCertificadoBancario?: string;
  urlSeguridadSocial?: string;
  urlComprobantePago?: string;
  /** Aliases usados en page.tsx para los campos de adjuntos */
  adjuntoCuentaCobro?: string;
  adjuntoCertBancario?: string;
  adjuntoSegSocial?: string;
  adjuntoComprobante?: string;

  estado: EstadoCuentaCobro;
  motivoRechazo?: string;
  fechaEnvio?: string;
  fechaAutorizacion?: string;
  autorizadoPor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTORIO — PAGOS DEL PERSONAL
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de pago disponibles para el historial del personal. */
export type TipoPagoPersonal =
  | 'Nomina'
  | 'Honorarios'
  | 'Bonificacion'
  | 'Anticipo'
  | 'Liquidacion'
  | 'Otro';

/** Etiquetas legibles para cada tipo de pago. */
export const ETIQUETA_TIPO_PAGO: Record<TipoPagoPersonal, string> = {
  Nomina:       'Nómina',
  Honorarios:   'Honorarios',
  Bonificacion: 'Bonificación',
  Anticipo:     'Anticipo',
  Liquidacion:  'Liquidación',
  Otro:         'Otro',
};

/** Registro de un pago realizado a un colaborador interno. */
export interface PagoPersonal {
  id: string;
  usuarioId: string;
  /** Nombre del colaborador (JOIN — para vistas de administrador). */
  nombreUsuario?: string;
  valorCop: number;
  concepto: string;
  numeroComprobante?: string;
  tipoPago: TipoPagoPersonal;
  fechaPago: string;      // YYYY-MM-DD
  horaPago?: string;      // HH:MM
  periodo?: string;
  notas?: string;
  /** Nombre del usuario que registró el pago. */
  registradoPor?: string;
  creadoEn?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BITÁCORA ESTRATÉGICA
// ─────────────────────────────────────────────────────────────────────────────

/** Estados anímicos disponibles para el cierre del día. */
export type EstadoAnimico = 'Feliz' | 'Productivo' | 'Estresado' | 'Agotado';

/** Emoji representativo de cada estado anímico. */
export const EMOJI_ANIMICO: Record<EstadoAnimico, string> = {
  Feliz:      '😊',
  Productivo: '🚀',
  Estresado:  '😰',
  Agotado:    '😴',
};

/** Una actividad individual dentro de un registro de bitácora. */
export interface ActividadBitacora {
  id?: string;
  registroId?: string;
  descripcion: string;
  horas: number;
  orden?: number;
}

/** Registro completo de un día de trabajo. */
export interface RegistroBitacora {
  id: string;
  usuarioId: string;
  /** Nombre completo del usuario (JOIN — solo para vista CEO). */
  nombreUsuario?: string;
  fecha: string;                  // YYYY-MM-DD
  actividades: ActividadBitacora[];
  porcentajeAvance: number;       // 0-100
  estadoAnimico: EstadoAnimico;
  totalHoras?: number;            // calculado en cliente
  /** Feedback del CEO */
  comentarioCeo?: string;
  comentarioLeido: boolean;
  comentadoEn?: string;
  creadoEn?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE INTERFAZ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estructura de un ítem en el menú de navegación lateral.
 */
export interface ItemNavegacion {
  etiqueta: string;
  ruta: string;
  icono: React.ComponentType<{ className?: string }>;
  rolesPermitidos: RolUsuario[];
  subItems?: Omit<ItemNavegacion, 'subItems'>[];
}

/**
 * Estado genérico para operaciones asíncronas.
 */
export interface EstadoOperacion<T = void> {
  cargando: boolean;
  error: string | null;
  datos: T | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS PERSONAL
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de documento almacenados en el repositorio personal. */
export type TipoDocumentoPersonal = 'seg_social' | 'cert_bancario' | 'cuenta_cobro_pdf';

/** Etiquetas legibles para cada tipo de documento. */
export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumentoPersonal, string> = {
  seg_social:       'Planilla Seguridad Social',
  cert_bancario:    'Certificado Bancario',
  cuenta_cobro_pdf: 'Cuenta de Cobro (PDF)',
};
