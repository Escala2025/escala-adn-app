"use client";

/**
 * @fileoverview Punto de entrada principal — Escala ADN.
 * Orquestador de navegación y layout. Cada módulo funcional es un componente
 * externo autogestivo en components/modulos/* que maneja sus propios datos.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ─── Contexto de autenticación (fuente única de verdad) ──────────────────────
import { ProveedorAuth, useAuth } from "@/lib/contexto-auth";

// ─── Actions solo usadas en esta capa de orquestación ────────────────────────

import { obtenerCuentasDeUsuario } from "@/lib/actions/cobros-actions";
import { obtenerNotificaciones, marcarLeidas, type Notificacion as NotificacionBD } from "@/lib/actions/notificaciones-actions";

// ─── Módulos externos autogestivos ───────────────────────────────────────────
import ModuloDashboard    from "@/components/modulos/dashboard/modulo-dashboard";
import ModuloUsuarios     from "@/components/modulos/usuarios/modulo-usuarios";
import ModuloDirectorio   from "@/components/modulos/directorio/modulo-directorio";
import ModuloContrasenas  from "@/components/modulos/contrasenas/modulo-contrasenas";
import ModuloProveedores  from "@/components/modulos/proveedores/modulo-proveedores";
import ModuloCobros       from "@/components/modulos/cobros/modulo-cobros";
import ModuloBitacora     from "@/components/modulos/bitacora/modulo-bitacora";
import ModuloInformes     from "@/components/modulos/informes/modulo-informes";
import ModuloExportacion  from "@/components/modulos/exportacion/modulo-exportacion";
import ModuloDocumentos   from "@/components/modulos/documentos/modulo-documentos";
import PanelPerfil        from "@/components/perfil/panel-perfil";

// ─── Tipos ───────────────────────────────────────────────────────────────────
import type { RolUsuario, Usuario, CuentaCobro, EstadoCuentaCobro } from "@/lib/tipos";

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES LOCALES
// ─────────────────────────────────────────────────────────────────────────────

function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(valor);
}

function obtenerIniciales(nombre: string): string {
  return nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONOS SVG (sin dependencias externas)
// ─────────────────────────────────────────────────────────────────────────────

const IcoLogout    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoDashboard = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoUsuarios  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoLlave     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const IcoProveedor = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoCobros    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
const IcoPagos     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcoCampana   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoBitacora  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
const IcoInformes  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IcoExportar  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IcoDocumentos = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const IcoPerfil    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoReloj     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoMenu      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IcoArchivo   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IcoFirma     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M20 19.5v.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>;
const IcoSubir     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const IcoCheck     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoX         = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoOjo = ({ visible }: { visible: boolean }) => visible
  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS LOCALES
// ─────────────────────────────────────────────────────────────────────────────

interface Notificacion {
  id: string;
  tipo: "cuenta_pendiente" | "cuenta_autorizada" | "cuenta_rechazada" | "cuenta_enviada";
  titulo: string;
  descripcion: string;
  paraUsuarioId: string;
  deUsuarioId?: string;
  fecha: string;
  leida: boolean;
  cuentaId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVEGACIÓN
// ─────────────────────────────────────────────────────────────────────────────

interface ItemNav {
  id: string;
  etiqueta: string;
  Icono: React.FC;
  rolesPermitidos: RolUsuario[];
}

const ITEMS_NAVEGACION: ItemNav[] = [
  { id: "dashboard",   etiqueta: "Dashboard",             Icono: IcoDashboard, rolesPermitidos: ["CEO", "TI", "Contable"] },
  { id: "usuarios",    etiqueta: "Usuarios y Roles",      Icono: IcoUsuarios,  rolesPermitidos: ["CEO", "TI"] },
  { id: "directorio",  etiqueta: "Directorio del Equipo", Icono: IcoUsuarios,  rolesPermitidos: ["CEO", "TI", "Contable", "Personal_base"] },
  { id: "contrasenas", etiqueta: "Gestor de Contraseñas", Icono: IcoLlave,     rolesPermitidos: ["CEO", "TI", "Contable", "Personal_base"] },
  { id: "proveedores", etiqueta: "Proveedores",           Icono: IcoProveedor, rolesPermitidos: ["CEO", "TI", "Contable"] },
  { id: "cobros",      etiqueta: "Cuentas de Cobro",      Icono: IcoCobros,    rolesPermitidos: ["CEO", "TI", "Contable", "Personal_base", "Proveedor"] },
  { id: "mis-pagos",   etiqueta: "Mis Pagos",             Icono: IcoPagos,     rolesPermitidos: ["CEO", "TI", "Contable", "Personal_base", "Proveedor"] },
  { id: "bitacora",    etiqueta: "Bitácora Estratégica",  Icono: IcoBitacora,  rolesPermitidos: ["CEO", "TI", "Contable", "Personal_base"] },
  { id: "informes",    etiqueta: "Informes y Analytics",  Icono: IcoInformes,  rolesPermitidos: ["CEO", "TI", "Contable"] },
  { id: "exportacion", etiqueta: "Exportar Reportes",     Icono: IcoExportar,  rolesPermitidos: ["CEO", "TI", "Contable", "Personal_base"] },
  { id: "documentos",  etiqueta: "Documentos Personal",   Icono: IcoDocumentos, rolesPermitidos: ["CEO", "TI", "Contable", "Personal_base", "Proveedor"] },
];

const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  CEO: "CEO", TI: "TI", Contable: "Contable", Personal_base: "Personal Base", Proveedor: "Proveedor",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES ATÓMICOS
// ─────────────────────────────────────────────────────────────────────────────

function Boton({
  children, onClick, variante = "primario", tipo = "button",
  deshabilitado = false, tamanio = "md", claseExtra = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variante?: "primario" | "secundario" | "peligro" | "fantasma";
  tipo?: "button" | "submit";
  deshabilitado?: boolean;
  tamanio?: "sm" | "md" | "lg";
  claseExtra?: string;
}) {
  const base = "inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantes = {
    primario:   "text-white focus:ring-[var(--cp)]",
    secundario: "bg-[var(--clm)] text-[var(--cd)] hover:bg-[var(--cl)] border border-[var(--border)] focus:ring-[var(--cp)]",
    peligro:    "bg-[var(--cs)] text-white hover:opacity-90 focus:ring-[var(--cs)]",
    fantasma:   "bg-transparent text-[var(--cp)] hover:bg-[var(--cl)] focus:ring-[var(--cp)]",
  };
  const tamanios = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-2.5 text-base" };
  const inlineStyle = variante === "primario" ? { backgroundColor: deshabilitado ? "#aaa" : "var(--cp)" } : {};

  return (
    <button type={tipo} onClick={onClick} disabled={deshabilitado}
      className={`${base} ${variantes[variante]} ${tamanios[tamanio]} ${claseExtra}`}
      style={inlineStyle}
    >
      {children}
    </button>
  );
}

function Campo({
  etiqueta, tipo = "text", valor, onChange, placeholder = "",
  requerido = false, error = "", deshabilitado = false, claseExtra = "", sufijo,
}: {
  etiqueta: string; tipo?: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; requerido?: boolean; error?: string;
  deshabilitado?: boolean; claseExtra?: string; sufijo?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${claseExtra}`}>
      <label className="text-xs font-semibold text-[var(--cd)] uppercase tracking-wide">
        {etiqueta}{requerido && <span className="text-[var(--cs)] ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type={tipo} value={valor} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={requerido} disabled={deshabilitado}
          className={`w-full px-3 py-2 text-sm rounded-lg border bg-white text-[var(--cd)] placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-[var(--cp)] focus:border-transparent
            disabled:bg-[var(--clm)] disabled:cursor-not-allowed transition-colors
            ${error ? "border-[var(--cs)]" : "border-[var(--clm)]"} ${sufijo ? "pr-10" : ""}`}
        />
        {sufijo && <div className="absolute right-3 top-1/2 -translate-y-1/2">{sufijo}</div>}
      </div>
      {error && <p className="text-xs text-[var(--cs)]">{error}</p>}
    </div>
  );
}

function InsigniaEstado({ estado }: { estado: string }) {
  const estilos: Record<string, string> = {
    Pendiente: "bg-amber-100 text-amber-800",
    "En revisión": "bg-blue-100 text-blue-800",
    Autorizado: "bg-emerald-100 text-emerald-800",
    Rechazado: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${estilos[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {estado}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: LOGIN
// ─────────────────────────────────────────────────────────────────────────────

function PaginaIngreso() {
  const { ingresar, cargando, error, limpiarError } = useAuth();
// Campos vacíos — el usuario siempre debe ingresar sus credenciales manualmente
const [correo, setCorreo]         = useState('');
const [contrasena, setContrasena] = useState('');
  const [mostrar, setMostrar]     = useState(false);

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarError();
    await ingresar(correo, contrasena);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--cd2)" }}>
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, var(--cp) 0%, transparent 50%), radial-gradient(circle at 80% 20%, var(--cs) 0%, transparent 40%)" }}
      />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
         <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ backgroundColor: "#008080" }}>
  <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" stroke="#f5f0eb" strokeWidth="3" strokeLinecap="round">
    <rect x="8" y="8" width="84" height="84" rx="18" strokeWidth="5"/>
    <path d="M50 18c18 4 18 20 0 32-18 12-18 28 0 32M50 18c-18 4-18 20 0 32 18 12 18 28 0 32" />
    <line x1="42" y1="26" x2="58" y2="26" /><line x1="38" y1="33" x2="62" y2="33" /><line x1="42" y1="40" x2="58" y2="40" />
    <line x1="42" y1="60" x2="58" y2="60" /><line x1="38" y1="67" x2="62" y2="67" /><line x1="42" y1="74" x2="58" y2="74" />
  </svg>
</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Escala <span style={{ color: "var(--cpl)" }}>ADN</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--cl)", opacity: 0.6 }}>Ecosistema de Inteligencia Operativa</p>
        </div>

        <div className="rounded-2xl shadow-2xl p-8" style={{ backgroundColor: "var(--cl)" }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--cd)" }}>Bienvenido al siguiente nivel de gestión Iniciar Sesión</h2>
          <p className="text-xs mb-6 text-gray-500">Ingresa tus credenciales corporativas para continuar.</p>

          <form onSubmit={manejarEnvio} className="space-y-5">
            <Campo etiqueta="Correo electrónico" tipo="email" valor={correo} onChange={setCorreo}
              placeholder="usuario@escala.edu.co" requerido />
            <Campo etiqueta="Contraseña" tipo={mostrar ? "text" : "password"} valor={contrasena}
              onChange={setContrasena} placeholder="••••••••" requerido
              sufijo={
                <button type="button" onClick={() => setMostrar(!mostrar)} className="text-gray-400 hover:text-[var(--cp)] transition-colors">
                  <IcoOjo visible={mostrar} />
                </button>
              }
            />
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: "#fee2e2", color: "var(--cs)" }}>
                <IcoX />{error}
              </div>
            )}
            <Boton tipo="submit" deshabilitado={cargando || !correo || !contrasena} tamanio="lg" claseExtra="w-full justify-center">
              {cargando ? (
                <><span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "white", borderTopColor: "transparent" }} />Verificando...</>
              ) : "Acceder al Centro de Comando"}
            </Boton>
          </form>
          <p className="text-xs text-center mt-6 text-gray-400">Escala Consciencia &amp; Negocios BIC SAS </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BARRA LATERAL
// ─────────────────────────────────────────────────────────────────────────────

function BarraLateral({
  moduloActivo, onCambiarModulo, abierta, onCerrar,
}: {
  moduloActivo: string;
  onCambiarModulo: (id: string) => void;
  abierta: boolean;
  onCerrar: () => void;
}) {
  const { usuario, cerrarSesion } = useAuth();
  if (!usuario) return null;

  const items = ITEMS_NAVEGACION.filter((i) => i.rolesPermitidos.includes(usuario.rol));

  return (
    <>
      {abierta && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onCerrar} />}
      <aside
        className={`fixed lg:static z-50 lg:z-auto flex flex-col h-full w-64 shrink-0 transition-transform duration-300 lg:translate-x-0 ${abierta ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "var(--cd)", color: "var(--cl)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: "1px solid rgba(241,236,230,0.1)" }}>
     <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#008080" }}>
  <svg viewBox="0 0 100 100" className="w-6 h-6" fill="none" stroke="#f5f0eb" strokeWidth="3" strokeLinecap="round">
    <rect x="8" y="8" width="84" height="84" rx="18" strokeWidth="5"/>
    <path d="M50 18c18 4 18 20 0 32-18 12-18 28 0 32M50 18c-18 4-18 20 0 32 18 12 18 28 0 32" />
    <line x1="42" y1="26" x2="58" y2="26" /><line x1="38" y1="33" x2="62" y2="33" /><line x1="42" y1="40" x2="58" y2="40" />
    <line x1="42" y1="60" x2="58" y2="60" /><line x1="38" y1="67" x2="62" y2="67" /><line x1="42" y1="74" x2="58" y2="74" />
  </svg>
</div>
          <div><p className="text-sm font-bold leading-tight">Escala ADN</p><p className="text-xs opacity-50"></p></div>
        </div>

        {/* Perfil */}
        <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(241,236,230,0.1)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: "var(--cs)", color: "white" }}>
              {obtenerIniciales(usuario.nombreCompleto)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--cl)" }}>{usuario.nombreCompleto}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--cp)", color: "white" }}>
                {ETIQUETAS_ROL[usuario.rol]}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="text-xs font-bold uppercase tracking-widest opacity-40 px-3 mb-2">Módulos</p>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const activo = moduloActivo === item.id;
              return (
                <li key={item.id}>
                  <button onClick={() => { onCambiarModulo(item.id); onCerrar(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left ${activo ? "text-white" : "opacity-70 hover:opacity-100 hover:bg-white/5"}`}
                    style={activo ? { backgroundColor: "var(--cp)" } : {}}
                  >
                    <item.Icono />{item.etiqueta}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Pie */}
        <div className="p-4" style={{ borderTop: "1px solid rgba(241,236,230,0.1)" }}>
          <button onClick={cerrarSesion}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium opacity-70 hover:opacity-100 hover:bg-white/10 transition-all duration-150"
          >
            <IcoLogout />Cerrar Sesión
          </button>
          <p className="text-xs text-center mt-3 opacity-30">© 2025 Escala BIC SAS</p>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: MIS PAGOS
// ─────────────────────────────────────────────────────────────────────────────

function ModuloMisPagos() {
  const { usuario } = useAuth();
  const [cuentas, setCuentas]   = useState<CuentaCobro[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      const res = await obtenerCuentasDeUsuario(usuario.id);
      if (res.ok && res.datos) setCuentas(res.datos as CuentaCobro[]);
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  // La query ya filtra por usuario_id en BD, pero mantenemos el guard para robustez
  const misCuentas = cuentas;

  const resumen = {
    pendientes:  misCuentas.filter((c) => c.estado === "Pendiente").length,
    autorizados: misCuentas.filter((c) => c.estado === "Autorizado").length,
    rechazados:  misCuentas.filter((c) => c.estado === "Rechazado").length,
    total: misCuentas.reduce((acc, c) => c.estado === "Autorizado" ? acc + c.valorNumerico : acc, 0),
  };

  if (cargando) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cp)", borderTopColor: "transparent" }} />
          <p className="text-sm text-gray-500">Cargando tus pagos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--cd)]">Mis Pagos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Estado y seguimiento de tus cuentas de cobro enviadas.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { titulo: "Pendientes",   valor: resumen.pendientes,             color: "#d97706", bg: "#fef3c7" },
          { titulo: "Autorizados",  valor: resumen.autorizados,            color: "#059669", bg: "#d1fae5" },
          { titulo: "Rechazados",   valor: resumen.rechazados,             color: "var(--cs)", bg: "#fee2e2" },
          { titulo: "Total Pagado", valor: formatearMoneda(resumen.total), color: "var(--cp)", bg: "#e6f3f5" },
        ].map((m) => (
          <div key={m.titulo} className="bg-white rounded-xl p-4 border border-[var(--clm)] shadow-sm">
            <p className="text-xl font-bold" style={{ color: m.color }}>{m.valor}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.titulo}</p>
          </div>
        ))}
      </div>

      {misCuentas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="flex justify-center mb-3"><IcoPagos /></div>
          <p className="text-sm">Aún no has enviado cuentas de cobro.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {misCuentas.map((cc) => (
            <div key={cc.id}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${
                cc.estado === "Autorizado" ? "border-emerald-300" :
                cc.estado === "Rechazado"  ? "border-red-200"    : "border-[var(--clm)]"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">Cuenta #{cc.numeroCuenta}</span>
                    <InsigniaEstado estado={cc.estado} />
                  </div>
                  <p className="text-lg font-bold" style={{ color: "var(--cp)" }}>{formatearMoneda(cc.valorNumerico)}</p>
                  <p className="text-sm text-gray-600">{cc.valorLetras}</p>
                  <p className="text-xs text-gray-400">Concepto: {cc.concepto}</p>
                  <p className="text-xs text-gray-400">Fecha: {cc.fechaDocumento}</p>
                </div>
                <div className="sm:text-right space-y-1 shrink-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos Bancarios</p>
                  <p className="text-xs text-gray-600">{cc.datosBancarios.banco} — {cc.datosBancarios.tipoCuenta}</p>
                  <p className="text-xs text-gray-500">{cc.datosBancarios.numeroCuenta}</p>
                </div>
              </div>

              {/* Adjuntos */}
              {(cc.urlCertificadoBancario || cc.urlSeguridadSocial || cc.urlComprobantePago) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {cc.urlSeguridadSocial     && <span className="flex items-center gap-1 text-xs bg-[var(--cl)] text-gray-600 px-2 py-1 rounded-lg"><IcoArchivo />Seg. Social adjunta</span>}
                  {cc.urlCertificadoBancario && <span className="flex items-center gap-1 text-xs bg-[var(--cl)] text-gray-600 px-2 py-1 rounded-lg"><IcoArchivo />Cert. de Cuenta adjunto</span>}
                  {cc.urlComprobantePago     && (
                    <a href={cc.urlComprobantePago} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-medium">
                      <IcoCheck />Ver Comprobante de Pago
                    </a>
                  )}
                </div>
              )}

              {cc.motivoRechazo && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs font-semibold text-red-700 mb-1">Motivo de rechazo:</p>
                  <p className="text-xs text-red-600">{cc.motivoRechazo}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA ACCESO DENEGADO
// ─────────────────────────────────────────────────────────────────────────────

function PantallaAccesoDenegado({ moduloSolicitado, rol }: { moduloSolicitado: string; rol: RolUsuario }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(186,86,40,0.1)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs)" strokeWidth={1.8} className="w-10 h-10">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--cd)" }}>Acceso Restringido</h2>
      <p className="text-gray-500 text-sm max-w-sm">
        Tu rol <span className="font-semibold" style={{ color: "var(--cp)" }}>({rol.replace("_", " ")})</span>{" "}
        no tiene permisos para acceder a <span className="font-semibold text-[var(--cd)]">&ldquo;{moduloSolicitado}&rdquo;</span>.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORQUESTADOR PRINCIPAL (requiere ProveedorAuth como padre)
// ─────────────────────────────────────────────────────────────────────────────

function AppInterna() {
  const { usuario, cerrarSesion, cargando } = useAuth();

  const [moduloActivo,   setModuloActivo]   = useState("dashboard");
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [panelNotif,     setPanelNotif]     = useState(false);
  const [modalPerfil,    setModalPerfil]    = useState(false);
  const [notifs,         setNotifs]         = useState<NotificacionBD[]>([]);
  const [noLeidas,       setNoLeidas]       = useState(0);
  const [cargandoNotif,  setCargandoNotif]  = useState(false);

  // Ajustar módulo inicial según rol
  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "Personal_base") setModuloActivo("contrasenas");
    else if (usuario.rol === "Proveedor") setModuloActivo("cobros");
    else setModuloActivo("dashboard");
  }, [usuario]);

  // Cargar notificaciones al abrir el panel o cada 90 segundos
  const cargarNotificaciones = useCallback(async () => {
    if (!usuario) return;
    setCargandoNotif(true);
    try {
      const res = await obtenerNotificaciones(usuario.id);
      if (res.ok) { setNotifs(res.datos); setNoLeidas(res.noLeidas); }
    } finally { setCargandoNotif(false); }
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    cargarNotificaciones();
    const intervalo = setInterval(cargarNotificaciones, 90_000);
    return () => clearInterval(intervalo);
  }, [usuario, cargarNotificaciones]);

  const marcarTodasLeidas = useCallback(async () => {
    if (!usuario || noLeidas === 0) return;
    await marcarLeidas(usuario.id);
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    setNoLeidas(0);
  }, [usuario, noLeidas]);

  if (!usuario) {
    if (cargando) {
      return (
        <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#f5f0eb" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "var(--cp)", borderTopColor: "transparent" }} />
            <p className="text-sm font-medium" style={{ color: "var(--cd)" }}>Cargando Escala ADN...</p>
          </div>
        </div>
      );
    }
    return <PaginaIngreso />;
  }

  const renderizarModulo = () => {
    const itemNav    = ITEMS_NAVEGACION.find((n) => n.id === moduloActivo);
    const tieneAcceso = itemNav?.rolesPermitidos.includes(usuario.rol) ?? false;

    if (!tieneAcceso) {
      const inicio = usuario.rol === "Personal_base" ? "contrasenas" : usuario.rol === "Proveedor" ? "cobros" : "dashboard";
      setTimeout(() => setModuloActivo(inicio), 0);
      return <PantallaAccesoDenegado moduloSolicitado={itemNav?.etiqueta ?? moduloActivo} rol={usuario.rol} />;
    }

    switch (moduloActivo) {
      case "dashboard":   return <ModuloDashboard />;
      case "usuarios":    return <ModuloUsuarios />;
      case "directorio":  return <ModuloDirectorio />;
      case "contrasenas": return <ModuloContrasenas />;
      case "proveedores": return <ModuloProveedores />;
      case "cobros":      return <ModuloCobros />;
      case "mis-pagos":   return <ModuloMisPagos />;
      case "bitacora":    return <ModuloBitacora />;
      case "informes":    return <ModuloInformes />;
      case "exportacion": return <ModuloExportacion />;
      case "documentos":  return <ModuloDocumentos />;
      default:            return <ModuloDashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f5f0eb" }}>
      <BarraLateral
        moduloActivo={moduloActivo}
        onCambiarModulo={(id) => { setModuloActivo(id); setPanelNotif(false); }}
        abierta={sidebarAbierto}
        onCerrar={() => setSidebarAbierto(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--clm)] shrink-0" style={{ backgroundColor: "white" }}>
          <button onClick={() => setSidebarAbierto(true)} className="lg:hidden p-2 rounded-lg text-[var(--cd)] hover:bg-[var(--cl)] transition-colors">
            <IcoMenu />
          </button>
          <span className="lg:hidden font-bold text-[var(--cd)]">Escala <span style={{ color: "var(--cp)" }}>ADN</span></span>
          <span className="hidden lg:block font-semibold text-sm text-gray-500">
            {ITEMS_NAVEGACION.find((n) => n.id === moduloActivo)?.etiqueta ?? "Inicio"}
          </span>
          <div className="flex-1" />

          {/* Campana */}
          <div className="relative">
            <button
              onClick={() => { setPanelNotif((v) => !v); setModalPerfil(false); if (!panelNotif) cargarNotificaciones(); }}
              className="relative p-2 rounded-lg text-[var(--cd)] hover:bg-[var(--cl)] transition-colors"
            >
              <IcoCampana />
              {noLeidas > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: "var(--cs)" }}>
                  {noLeidas > 9 ? "9+" : noLeidas}
                </span>
              )}
            </button>
            {panelNotif && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPanelNotif(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-[var(--clm)] z-40 overflow-hidden flex flex-col" style={{ maxHeight: "420px" }}>
                  <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--clm)" }}>
                    <p className="font-semibold text-sm text-[var(--cd)]">
                      Notificaciones {noLeidas > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "var(--cs)" }}>{noLeidas}</span>}
                    </p>
                    {noLeidas > 0 && (
                      <button onClick={marcarTodasLeidas} className="text-xs font-medium" style={{ color: "var(--cp)" }}>
                        Marcar leídas
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {cargandoNotif ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--cp)", borderTopColor: "transparent" }} />
                      </div>
                    ) : notifs.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <div className="w-10 h-10 rounded-full bg-[var(--cl)] flex items-center justify-center mx-auto mb-3">
                          <IcoCampana />
                        </div>
                        <p className="text-sm text-gray-400">Sin notificaciones</p>
                      </div>
                    ) : (
                      notifs.map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b border-[var(--clm)] transition-colors ${!n.leida ? "bg-[rgba(0,122,136,0.04)]" : ""}`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.leida ? "bg-[var(--cp)]" : "bg-transparent"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[var(--cd)]">{n.titulo}</p>
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.descripcion}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(n.creadoEn).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Perfil */}
          <button
            onClick={() => { setModalPerfil(true); setPanelNotif(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--cl)] transition-colors"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: "var(--cd)" }}>
              {obtenerIniciales(usuario.nombreCompleto)}
            </div>
            <span className="hidden sm:block text-xs font-medium text-[var(--cd)] max-w-[100px] truncate">
              {usuario.nombreCompleto.split(" ")[0]}
            </span>
          </button>
          <PanelPerfil abierto={modalPerfil} onCerrar={() => setModalPerfil(false)} />
        </header>

        <main className="flex-1 overflow-y-auto">{renderizarModulo()}</main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT — envuelve todo en ProveedorAuth
// ─────────────────────────────────────────────────────────────────────────────

export default function EscalaADN() {
  return (
    <ProveedorAuth>
      <AppInterna />
    </ProveedorAuth>
  );
}
