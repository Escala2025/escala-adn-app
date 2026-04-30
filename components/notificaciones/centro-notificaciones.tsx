"use client";

/**
 * @fileoverview Campana de notificaciones con panel desplegable.
 * Se integra en el header de AplicacionEscala. Consume useNotificaciones.
 */

import { useRef, useEffect, useState } from "react";
import type { Notificacion, TipoNotif } from "@/lib/hooks/use-notificaciones";

// ─────────────────────────────────────────────────────────────────────────────
// ICONOS
// ─────────────────────────────────────────────────────────────────────────────

const IcoCampana = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const IcoCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IcoRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// COLOR POR TIPO
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_TIPO: Record<TipoNotif, { color: string; fondo: string; etiqueta: string }> = {
  cobro_pendiente:    { color: "#d97706", fondo: "#fef3c7", etiqueta: "Pendiente" },
  cobro_autorizado:   { color: "#059669", fondo: "#d1fae5", etiqueta: "Autorizado" },
  cobro_rechazado:    { color: "#dc2626", fondo: "#fee2e2", etiqueta: "Rechazado" },
  cobro_en_revision:  { color: "#2563eb", fondo: "#dbeafe", etiqueta: "En Revisión" },
  bitacora_feedback:  { color: "#7c3aed", fondo: "#ede9fe", etiqueta: "Feedback CEO" },
};

// ─────────────────────────────────────────────────────────────────────────────
// ÍTEM DE NOTIFICACIÓN
// ─────────────────────────────────────────────────────────────────────────────

function ItemNotificacion({
  notif,
  onMarcarLeida,
  onNavegar,
}: {
  notif: Notificacion;
  onMarcarLeida: (id: string) => void;
  onNavegar: (modulo: string) => void;
}) {
  const cfg = CONFIG_TIPO[notif.tipo];
  const fecha = new Date(notif.fecha);
  const ahora = new Date();
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const tiempoRelativo =
    diffMin < 1   ? "Ahora"
    : diffMin < 60 ? `Hace ${diffMin} min`
    : diffMin < 1440 ? `Hace ${Math.floor(diffMin / 60)} h`
    : fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${!notif.leida ? "border-l-2" : "border-l-2 border-transparent"}`}
      style={{ borderLeftColor: notif.leida ? "transparent" : cfg.color }}
      onClick={() => {
        onMarcarLeida(notif.id);
        onNavegar(notif.moduloDestino);
      }}
    >
      {/* Punto indicador */}
      <div
        className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: notif.leida ? "#d1d5db" : cfg.color }}
      />

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.fondo, color: cfg.color }}
          >
            {cfg.etiqueta}
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>
            {tiempoRelativo}
          </span>
        </div>
        <p className="text-sm font-semibold mt-1 leading-snug" style={{ color: "var(--cd)" }}>
          {notif.titulo}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {notif.descripcion}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

interface CentroNotificacionesProps {
  notificaciones: Notificacion[];
  noLeidas: number;
  cargando: boolean;
  onCargar: () => void;
  onMarcarLeida: (id: string) => void;
  onMarcarTodasLeidas: () => void;
  onNavegar: (modulo: string) => void;
}

export default function CentroNotificaciones({
  notificaciones,
  noLeidas,
  cargando,
  onCargar,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onNavegar,
}: CentroNotificacionesProps) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!abierto) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón campana */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors hover:bg-white/10"
        aria-label="Centro de notificaciones"
        title="Notificaciones"
      >
        <IcoCampana />
        {noLeidas > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white text-[10px] font-bold px-1"
            style={{ backgroundColor: "var(--cs)" }}
          >
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {abierto && (
        <div
          className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden z-50"
          style={{
            backgroundColor: "white",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Header del panel */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--clm)" }}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold" style={{ color: "var(--cd)" }}>
                Notificaciones
              </h3>
              {noLeidas > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: "var(--cs)" }}
                >
                  {noLeidas} nueva{noLeidas !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {noLeidas > 0 && (
                <button
                  onClick={onMarcarTodasLeidas}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors hover:bg-gray-100"
                  style={{ color: "var(--cp)" }}
                  title="Marcar todas como leídas"
                >
                  <IcoCheck /> Leer todas
                </button>
              )}
              <button
                onClick={() => { onCargar(); }}
                disabled={cargando}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: "var(--muted-foreground)" }}
                title="Actualizar notificaciones"
              >
                <span className={cargando ? "animate-spin" : ""}><IcoRefresh /></span>
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto max-h-[420px] divide-y divide-gray-50">
            {notificaciones.length === 0 ? (
              <div className="py-12 text-center">
                <IcoCampana />
                <p className="text-sm mt-3 font-medium" style={{ color: "var(--cd)" }}>
                  Sin notificaciones
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                  Estás al día con todo
                </p>
              </div>
            ) : (
              notificaciones.map((n) => (
                <ItemNotificacion
                  key={n.id}
                  notif={n}
                  onMarcarLeida={onMarcarLeida}
                  onNavegar={(mod) => { onNavegar(mod); setAbierto(false); }}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div
              className="px-4 py-2.5 text-center"
              style={{ borderTop: "1px solid var(--clm)" }}
            >
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Mostrando {notificaciones.length} notificaciones — se actualiza cada 60 s
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
