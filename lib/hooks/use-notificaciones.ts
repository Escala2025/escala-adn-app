"use client";

/**
 * @fileoverview Hook para gestionar el centro de notificaciones de Escala ADN.
 * Genera notificaciones automáticas basadas en el estado de cuentas de cobro
 * y comentarios de la bitácora estratégica. Persiste el estado "leído" en
 * localStorage para sobrevivir recargas sin necesidad de una tabla adicional en BD.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { obtenerCuentasDeUsuario, obtenerTodasLasCuentas } from "@/lib/actions/cobros-actions";
import { obtenerMisRegistros, obtenerTodosLosRegistros } from "@/lib/actions/bitacora-actions";
import type { CuentaCobro, RegistroBitacora, RolUsuario } from "@/lib/tipos";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type TipoNotif =
  | "cobro_pendiente"
  | "cobro_autorizado"
  | "cobro_rechazado"
  | "cobro_en_revision"
  | "bitacora_feedback";

export interface Notificacion {
  id: string;
  tipo: TipoNotif;
  titulo: string;
  descripcion: string;
  fecha: string;
  leida: boolean;
  /** Módulo al que navegar al hacer clic */
  moduloDestino: string;
  /** ID del recurso relacionado (cuenta o registro) */
  referenciaId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "escala_notif_leidas_v2";

function cargarLeidas(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function guardarLeidas(leidas: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...leidas]));
  } catch {/* sin-op */}
}

function formatearMoneda(v: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADORES
// ─────────────────────────────────────────────────────────────────────────────

function notifsDeCuentas(
  cuentas: CuentaCobro[],
  usuarioId: string,
  rol: RolUsuario,
  leidasSet: Set<string>,
): Notificacion[] {
  const notifs: Notificacion[] = [];
  const esCEO      = rol === "CEO";
  const esContable = rol === "Contable";

  for (const c of cuentas) {
    const esPropia = c.usuarioId === usuarioId;

    // CEO/Contable: alertas de cuentas pendientes que necesitan acción
    if ((esCEO || esContable) && c.estado === "Pendiente") {
      const id = `cobro_pendiente_${c.id}`;
      notifs.push({
        id,
        tipo: "cobro_pendiente",
        titulo: "Cuenta pendiente de revisión",
        descripcion: `${c.nombreSolicitante} — ${formatearMoneda(c.valorNumerico)}`,
        fecha: c.fechaEnvio ?? c.fechaDocumento,
        leida: leidasSet.has(id),
        moduloDestino: "cobros",
        referenciaId: c.id,
      });
    }

    // CEO: cuentas en revisión (el Contable ya las marcó)
    if (esCEO && c.estado === "En revisión") {
      const id = `cobro_revision_${c.id}`;
      notifs.push({
        id,
        tipo: "cobro_en_revision",
        titulo: "Cuenta lista para autorizar",
        descripcion: `${c.nombreSolicitante} — ${formatearMoneda(c.valorNumerico)} revisada por contabilidad`,
        fecha: c.fechaEnvio ?? c.fechaDocumento,
        leida: leidasSet.has(id),
        moduloDestino: "cobros",
        referenciaId: c.id,
      });
    }

    // Propias: notificar cambio de estado (autorizado / rechazado)
    if (esPropia && c.estado === "Autorizado") {
      const id = `cobro_auth_${c.id}`;
      notifs.push({
        id,
        tipo: "cobro_autorizado",
        titulo: "Tu cuenta fue autorizada",
        descripcion: `Cuenta #${c.numeroCuenta} — ${formatearMoneda(c.valorNumerico)} aprobada`,
        fecha: c.fechaAutorizacion ?? c.fechaEnvio ?? c.fechaDocumento,
        leida: leidasSet.has(id),
        moduloDestino: "mis-pagos",
        referenciaId: c.id,
      });
    }

    if (esPropia && c.estado === "Rechazado") {
      const id = `cobro_rej_${c.id}`;
      notifs.push({
        id,
        tipo: "cobro_rechazado",
        titulo: "Tu cuenta fue rechazada",
        descripcion: `Cuenta #${c.numeroCuenta} — ${c.motivoRechazo ?? "ver detalles"}`,
        fecha: c.fechaAutorizacion ?? c.fechaEnvio ?? c.fechaDocumento,
        leida: leidasSet.has(id),
        moduloDestino: "mis-pagos",
        referenciaId: c.id,
      });
    }
  }
  return notifs;
}

function notifsDeBitacora(
  registros: RegistroBitacora[],
  leidasSet: Set<string>,
): Notificacion[] {
  return registros
    .filter((r) => r.comentarioCeo && !r.comentarioLeido)
    .map((r) => {
      const id = `bitacora_feedback_${r.id}`;
      return {
        id,
        tipo: "bitacora_feedback" as TipoNotif,
        titulo: "El CEO comentó tu bitácora",
        descripcion: `${r.fecha} — "${(r.comentarioCeo ?? "").slice(0, 60)}${(r.comentarioCeo?.length ?? 0) > 60 ? "…" : ""}"`,
        fecha: r.comentadoEn ?? r.fecha,
        leida: leidasSet.has(id),
        moduloDestino: "bitacora",
        referenciaId: r.id,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const INTERVALO_MS = 60_000; // refresco automático cada 60 s

export function useNotificaciones(
  usuarioId: string | undefined,
  rol: RolUsuario | undefined,
) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando]             = useState(false);
  const leidasRef = useRef<Set<string>>(cargarLeidas());

  const cargar = useCallback(async () => {
    if (!usuarioId || !rol) return;
    setCargando(true);
    const leidas = leidasRef.current;
    const notifs: Notificacion[] = [];

    try {
      // ── Cuentas de cobro ──────────────────────────────────────────────────
      const esCEOoAdmin = rol === "CEO" || rol === "TI" || rol === "Contable";
      const [resCuentas, resBitacora] = await Promise.allSettled([
        esCEOoAdmin
          ? obtenerTodasLasCuentas()
          : obtenerCuentasDeUsuario(usuarioId),
        // Bitácora: solo usuarios no-CEO ven el feedback de sus propios registros
        rol !== "CEO"
          ? obtenerMisRegistros(usuarioId)
          : Promise.resolve({ ok: true, datos: [] as RegistroBitacora[] }),
      ]);

      const cuentas: CuentaCobro[] =
        resCuentas.status === "fulfilled" && resCuentas.value.ok
          ? (resCuentas.value.datos ?? [])
          : [];

      const registros: RegistroBitacora[] =
        resBitacora.status === "fulfilled" && resBitacora.value.ok
          ? (resBitacora.value.datos ?? [])
          : [];

      notifs.push(...notifsDeCuentas(cuentas, usuarioId, rol, leidas));
      notifs.push(...notifsDeBitacora(registros, leidas));

      // CEO ve notificaciones de bitácora que él mismo generó (para depuración)
      // no aplica — CEO no recibe feedback de sí mismo

    } catch {/* sin-op */}

    // Ordenar: no leídas primero, luego por fecha desc
    notifs.sort((a, b) => {
      if (a.leida !== b.leida) return a.leida ? 1 : -1;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });

    setNotificaciones(notifs.slice(0, 50));
    setCargando(false);
  }, [usuarioId, rol]);

  // Carga inicial y refresco automático
  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [cargar]);

  /** Marcar una notificación individual como leída */
  const marcarLeida = useCallback((id: string) => {
    leidasRef.current.add(id);
    guardarLeidas(leidasRef.current);
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    );
  }, []);

  /** Marcar todas como leídas */
  const marcarTodasLeidas = useCallback(() => {
    setNotificaciones((prev) => {
      const nuevas = prev.map((n) => {
        leidasRef.current.add(n.id);
        return { ...n, leida: true };
      });
      guardarLeidas(leidasRef.current);
      return nuevas;
    });
  }, []);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return { notificaciones, noLeidas, cargando, cargar, marcarLeida, marcarTodasLeidas };
}
