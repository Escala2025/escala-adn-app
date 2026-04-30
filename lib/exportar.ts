/**
 * @fileoverview Utilidades de exportación para Escala ADN.
 * Genera archivos PDF (via jsPDF) y CSV (compatible con Excel) en el cliente.
 * No requiere dependencias de servidor — todo corre en el navegador.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ColumnaExport {
  cabecera: string;
  /** Llave del objeto o función extractora */
  campo: string | ((row: Record<string, unknown>) => string | number);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function formatearMonedaCOP(v: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(v);
}

function celdaCSV(valor: unknown): string {
  const s = String(valor ?? "").replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

function extraerValor(
  fila: Record<string, unknown>,
  campo: ColumnaExport["campo"],
): string | number {
  if (typeof campo === "function") return campo(fila);
  const partes = (campo as string).split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let val: any = fila;
  for (const p of partes) val = val?.[p];
  return val ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR CSV (abre en Excel con doble clic)
// ─────────────────────────────────────────────────────────────────────────────

export function exportarCSV(
  datos: Record<string, unknown>[],
  columnas: ColumnaExport[],
  nombreArchivo: string,
): void {
  const encabezado = columnas.map((c) => celdaCSV(c.cabecera)).join(",");
  const filas = datos.map((fila) =>
    columnas.map((c) => celdaCSV(extraerValor(fila, c.campo))).join(","),
  );
  // BOM para que Excel reconozca UTF-8
  const contenido = "\uFEFF" + [encabezado, ...filas].join("\r\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR PDF (jsPDF — lazy import)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportarPDF(
  datos: Record<string, unknown>[],
  columnas: ColumnaExport[],
  titulo: string,
  subtitulo: string,
  nombreArchivo: string,
): Promise<void> {
  // Importación dinámica para no engrosar el bundle principal
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // ── Cabecera ────────────────────────────────────────────────────────────────
  doc.setFillColor(0, 122, 136);          // var(--cp) #007a88
  doc.rect(0, 0, 297, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Escala ADN — Plataforma Corporativa", 14, 13);

  doc.setFillColor(4, 40, 66);            // var(--cd) #042842
  doc.rect(0, 20, 297, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(titulo, 14, 27);
  doc.setTextColor(200, 220, 230);
  doc.setFontSize(8);
  doc.text(subtitulo, 14, 32);

  // Fecha de generación
  doc.setTextColor(200, 220, 230);
  doc.setFontSize(7);
  doc.text(
    `Generado: ${new Date().toLocaleString("es-CO")}`,
    297 - 14,
    27,
    { align: "right" },
  );

  // ── Tabla ───────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 38,
    head: [columnas.map((c) => c.cabecera)],
    body: datos.map((fila) =>
      columnas.map((c) => extraerValor(fila as Record<string, unknown>, c.campo)),
    ),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [0, 122, 136],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [245, 250, 251] },
    margin: { left: 14, right: 14 },
  });

  // ── Pie de página ────────────────────────────────────────────────────────────
  const totalPaginas = (doc as unknown as { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Escala Consciencia & Negocios BIC SAS — NIT: 811.007.550-3 | Página ${i} de ${totalPaginas}`,
      148.5,
      205,
      { align: "center" },
    );
  }

  doc.save(`${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIONES PREDEFINIDAS
// ─────────────────────────────────────────────────────────────────────────────

/** Columnas para exportar cuentas de cobro */
export const COLUMNAS_COBROS: ColumnaExport[] = [
  { cabecera: "N° Cuenta",    campo: "numeroCuenta" },
  { cabecera: "Solicitante",  campo: "nombreSolicitante" },
  { cabecera: "Cédula",       campo: "cedulaSolicitante" },
  { cabecera: "Valor (COP)",  campo: (r) => formatearMonedaCOP(Number(r.valorNumerico ?? 0)) },
  { cabecera: "Concepto",     campo: "concepto" },
  { cabecera: "Centro Costos",campo: "centroCostos" },
  { cabecera: "Banco",        campo: (r) => (r.datosBancarios as Record<string,string>)?.banco ?? "" },
  { cabecera: "Tipo Cuenta",  campo: (r) => (r.datosBancarios as Record<string,string>)?.tipoCuenta ?? "" },
  { cabecera: "Estado",       campo: "estado" },
  { cabecera: "Fecha Envío",  campo: (r) => r.fechaEnvio ? new Date(r.fechaEnvio as string).toLocaleDateString("es-CO") : "" },
  { cabecera: "Autorizado Por", campo: "autorizadoPor" },
  { cabecera: "Fecha Autorización", campo: (r) => r.fechaAutorizacion ? new Date(r.fechaAutorizacion as string).toLocaleDateString("es-CO") : "" },
  { cabecera: "Motivo Rechazo", campo: "motivoRechazo" },
];

/** Columnas para exportar registros de bitácora */
export const COLUMNAS_BITACORA: ColumnaExport[] = [
  { cabecera: "Fecha",          campo: "fecha" },
  { cabecera: "Usuario",        campo: "nombreUsuario" },
  { cabecera: "% Avance",       campo: (r) => `${r.porcentajeAvance ?? 0}%` },
  { cabecera: "Estado Anímico", campo: "estadoAnimico" },
  { cabecera: "Total Horas",    campo: (r) => `${r.totalHoras ?? 0} h` },
  { cabecera: "Actividades",    campo: (r) => Array.isArray(r.actividades)
    ? (r.actividades as { descripcion: string; horas: number }[])
        .map((a) => `${a.descripcion} (${a.horas}h)`).join(" | ")
    : "" },
  { cabecera: "Feedback CEO",   campo: "comentarioCeo" },
];

/** Columnas para exportar resumen del dashboard */
export const COLUMNAS_DASHBOARD: ColumnaExport[] = [
  { cabecera: "Indicador", campo: "indicador" },
  { cabecera: "Valor",     campo: "valor" },
  { cabecera: "Detalle",   campo: "detalle" },
];
