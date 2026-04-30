"use client";

/**
 * @fileoverview Botón de exportación (PDF / CSV) reutilizable.
 * Muestra un menú desplegable con ambas opciones. Carga jsPDF dinámicamente.
 */

import { useState, useRef, useEffect } from "react";
import {
  exportarCSV,
  exportarPDF,
  type ColumnaExport,
} from "@/lib/exportar";

const IcoDescargar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IcoChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IcoPDF = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const IcoExcel = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="19"/>
    <line x1="15" y1="13" x2="9" y2="19"/>
  </svg>
);

interface BotonExportarProps {
  datos: Record<string, unknown>[];
  columnas: ColumnaExport[];
  titulo: string;
  subtitulo?: string;
  nombreArchivo: string;
  /** Texto del botón. Por defecto "Exportar" */
  etiqueta?: string;
  deshabilitado?: boolean;
}

export default function BotonExportar({
  datos,
  columnas,
  titulo,
  subtitulo = "Escala Consciencia & Negocios BIC SAS",
  nombreArchivo,
  etiqueta = "Exportar",
  deshabilitado = false,
}: BotonExportarProps) {
  const [abierto, setAbierto]       = useState(false);
  const [generando, setGenerando]   = useState<"pdf" | "csv" | null>(null);
  const contenedorRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  const hacerCSV = async () => {
    setGenerando("csv");
    setAbierto(false);
    try {
      exportarCSV(datos, columnas, nombreArchivo);
    } finally {
      setGenerando(null);
    }
  };

  const hacerPDF = async () => {
    setGenerando("pdf");
    setAbierto(false);
    try {
      await exportarPDF(datos, columnas, titulo, subtitulo, nombreArchivo);
    } finally {
      setGenerando(null);
    }
  };

  const cargando = generando !== null;

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        disabled={deshabilitado || cargando || datos.length === 0}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "white",
          borderColor: "var(--clm)",
          color: "var(--cd)",
        }}
        title={datos.length === 0 ? "Sin datos para exportar" : "Exportar datos"}
      >
        {cargando ? (
          <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--cp)", borderTopColor: "transparent" }}
          />
        ) : (
          <IcoDescargar />
        )}
        {cargando ? (generando === "pdf" ? "Generando PDF…" : "Generando CSV…") : etiqueta}
        {!cargando && <IcoChevron />}
      </button>

      {abierto && (
        <div
          className="absolute right-0 top-11 w-48 rounded-xl shadow-xl overflow-hidden z-50"
          style={{ backgroundColor: "white", border: "1px solid rgba(0,0,0,0.08)" }}
        >
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={hacerPDF}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-red-50 text-left"
              style={{ color: "#dc2626" }}
            >
              <IcoPDF />
              Exportar PDF
            </button>
            <button
              onClick={hacerCSV}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-green-50 text-left"
              style={{ color: "#059669" }}
            >
              <IcoExcel />
              Exportar CSV / Excel
            </button>
          </div>
          <div
            className="px-3 py-2 text-xs text-center"
            style={{ borderTop: "1px solid var(--clm)", color: "var(--muted-foreground)" }}
          >
            {datos.length} registro{datos.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
