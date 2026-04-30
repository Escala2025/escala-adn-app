'use client';

/**
 * @fileoverview Módulo de Exportación — Escala ADN.
 * Genera reportes descargables en CSV/Excel y PDF desde datos del sistema.
 * Sin dependencias externas pesadas: CSV nativo, PDF via window.print().
 */

import { useState, useCallback } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import { obtenerTodasLasCuentas, obtenerCuentasDeUsuario } from '@/lib/actions/cobros-actions';
import { obtenerTodosLosRegistros, obtenerMisRegistros } from '@/lib/actions/bitacora-actions';
import { formatearMoneda } from '@/lib/utilidades';
import type { CuentaCobro, RegistroBitacora } from '@/lib/tipos';

// ─── Helpers de exportación ──────────────────────────────────────────────────

function descargarCSV(filas: string[][], nombreArchivo: string) {
  const contenido = filas.map(f =>
    f.map(celda => `"${String(celda ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

function generarHTMLParaPDF(titulo: string, subtitulo: string, html: string): string {
  return `<!DOCTYPE html><html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${titulo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #007a88; padding-bottom: 12px; }
    .header h1 { font-size: 18px; color: #007a88; }
    .header p  { font-size: 11px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #007a88; color: white; padding: 7px 8px; text-align: left; font-size: 10px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    tr:nth-child(even) td { background: #f8f9fa; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: bold; }
    .badge-ok  { background: #d1fae5; color: #065f46; }
    .badge-err { background: #fee2e2; color: #7f1d1d; }
    .badge-pen { background: #fef3c7; color: #78350f; }
    .badge-rev { background: #dbeafe; color: #1e3a5f; }
    .footer { margin-top: 20px; font-size: 9px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${titulo}</h1>
    <p>${subtitulo} — Generado el ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>
  ${html}
  <div class="footer">Escala Consciencia &amp; Negocios BIC SAS — NIT: 811.007.550-3 — Documento generado automáticamente</div>
</body></html>`;
}

function abrirVentanaPDF(titulo: string, subtitulo: string, html: string) {
  const ventana = window.open('', '_blank', 'width=900,height=700');
  if (!ventana) { alert('Permite ventanas emergentes para generar el PDF.'); return; }
  ventana.document.write(generarHTMLParaPDF(titulo, subtitulo, html));
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 600);
}

function insigniaHTML(estado: string): string {
  const cls = estado === 'Autorizado' ? 'badge-ok' : estado === 'Rechazado' ? 'badge-err' : estado === 'En revisión' ? 'badge-rev' : 'badge-pen';
  return `<span class="badge ${cls}">${estado}</span>`;
}

// ─── Funciones de generación de reportes ─────────────────────────────────────

function csvCuentas(cuentas: CuentaCobro[]) {
  const encabezado = ['N° Cuenta', 'Solicitante', 'Cédula', 'Valor (COP)', 'Concepto', 'Centro de Costos', 'Banco', 'Tipo Cuenta', 'Número Cuenta', 'Estado', 'Fecha Envío', 'Autorizado Por'];
  const filas = cuentas.map(c => [
    c.numeroCuenta, c.nombreSolicitante, c.cedulaSolicitante,
    c.valorNumerico.toString(), c.concepto, c.centroCostos,
    c.datosBancarios.banco, c.datosBancarios.tipoCuenta, c.datosBancarios.numeroCuenta,
    c.estado, c.fechaEnvio ? new Date(c.fechaEnvio).toLocaleDateString('es-CO') : '',
    c.autorizadoPor ?? '',
  ]);
  return [encabezado, ...filas];
}

function pdfCuentas(cuentas: CuentaCobro[]) {
  const filas = cuentas.map(c => `
    <tr>
      <td><strong>#${c.numeroCuenta}</strong></td>
      <td>${c.nombreSolicitante}<br/><small style="color:#888">${c.cedulaSolicitante}</small></td>
      <td style="color:#007a88;font-weight:bold">${formatearMoneda(c.valorNumerico)}</td>
      <td>${c.concepto}</td>
      <td>${c.datosBancarios.banco}</td>
      <td>${insigniaHTML(c.estado)}</td>
      <td>${c.fechaEnvio ? new Date(c.fechaEnvio).toLocaleDateString('es-CO') : '—'}</td>
    </tr>`).join('');
  return `<table>
    <thead><tr><th>N° Cuenta</th><th>Solicitante</th><th>Valor</th><th>Concepto</th><th>Banco</th><th>Estado</th><th>Fecha</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <p style="margin-top:12px;font-weight:bold;">
    Total autorizado: ${formatearMoneda(cuentas.filter(c => c.estado === 'Autorizado').reduce((s, c) => s + c.valorNumerico, 0))}
    &nbsp;|&nbsp; Total cuentas: ${cuentas.length}
  </p>`;
}

function csvBitacora(registros: RegistroBitacora[]) {
  const encabezado = ['Colaborador', 'Fecha', 'Actividades', 'Total Horas', 'Avance %', 'Estado Anímico', 'Comentario CEO'];
  const filas = registros.map(r => [
    r.nombreUsuario ?? r.usuarioId,
    r.fecha,
    r.actividades.map(a => `${a.descripcion} (${a.horas}h)`).join(' | '),
    r.actividades.reduce((s, a) => s + (a.horas || 0), 0).toString(),
    r.porcentajeAvance.toString(),
    r.estadoAnimico,
    r.comentarioCeo ?? '',
  ]);
  return [encabezado, ...filas];
}

function pdfBitacora(registros: RegistroBitacora[]) {
  const filas = registros.map(r => {
    const horas = r.actividades.reduce((s, a) => s + (a.horas || 0), 0);
    return `<tr>
      <td>${r.nombreUsuario ?? '—'}</td>
      <td>${r.fecha}</td>
      <td>${r.actividades.map(a => `${a.descripcion} (${a.horas}h)`).join('<br/>')}</td>
      <td style="text-align:center"><strong>${horas}h</strong></td>
      <td style="text-align:center">${r.porcentajeAvance}%</td>
      <td>${r.estadoAnimico}</td>
    </tr>`;
  }).join('');
  const totalHoras = registros.reduce((s, r) => s + r.actividades.reduce((ss, a) => ss + (a.horas || 0), 0), 0);
  return `<table>
    <thead><tr><th>Colaborador</th><th>Fecha</th><th>Actividades</th><th>Horas</th><th>Avance</th><th>Ánimo</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <p style="margin-top:12px;font-weight:bold;">Total horas registradas: ${totalHoras}h &nbsp;|&nbsp; Total registros: ${registros.length}</p>`;
}

// ─── Tarjeta de opción de exportación ────────────────────────────────────────

type EstadoExport = 'idle' | 'cargando' | 'ok' | 'error';

function TarjetaExport({
  titulo, descripcion, icono: Icono, colorIcono, fondoIcono,
  onCSV, onPDF,
}: {
  titulo: string; descripcion: string;
  icono: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  colorIcono: string; fondoIcono: string;
  onCSV: () => Promise<void>;
  onPDF: () => Promise<void>;
}) {
  const [estadoCSV, setEstadoCSV] = useState<EstadoExport>('idle');
  const [estadoPDF, setEstadoPDF] = useState<EstadoExport>('idle');

  const ejecutar = (setter: (s: EstadoExport) => void, fn: () => Promise<void>) => async () => {
    setter('cargando');
    try { await fn(); setter('ok'); setTimeout(() => setter('idle'), 2500); }
    catch { setter('error'); setTimeout(() => setter('idle'), 3000); }
  };

  const BotonAccion = ({ estado, onClick, formato }: { estado: EstadoExport; onClick: () => Promise<void>; formato: 'CSV' | 'PDF' }) => (
    <button onClick={onClick} disabled={estado === 'cargando'}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all"
      style={{
        borderColor: estado === 'ok' ? '#059669' : estado === 'error' ? '#dc2626' : 'var(--border)',
        color:       estado === 'ok' ? '#059669' : estado === 'error' ? '#dc2626' : 'var(--cd)',
        backgroundColor: estado === 'ok' ? '#d1fae5' : estado === 'error' ? '#fee2e2' : 'white',
      }}>
      {estado === 'cargando' ? <Loader2 size={14} className="animate-spin" /> :
       estado === 'ok'       ? <CheckCircle size={14} /> :
       estado === 'error'    ? <AlertCircle size={14} /> :
       formato === 'CSV'     ? <FileSpreadsheet size={14} /> : <FileText size={14} />}
      {estado === 'cargando' ? 'Generando...' : estado === 'ok' ? 'Listo' : estado === 'error' ? 'Error' : formato === 'CSV' ? 'Descargar CSV' : 'Descargar PDF'}
    </button>
  );

  return (
    <div className="bg-white rounded-xl p-6 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: fondoIcono }}>
          <Icono size={22} style={{ color: colorIcono }} />
        </div>
        <div>
          <h3 className="font-bold text-base" style={{ color: 'var(--cd)' }}>{titulo}</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{descripcion}</p>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <BotonAccion estado={estadoCSV} onClick={ejecutar(setEstadoCSV, onCSV)} formato="CSV" />
        <BotonAccion estado={estadoPDF} onClick={ejecutar(setEstadoPDF, onPDF)} formato="PDF" />
      </div>
    </div>
  );
}

// ─── Módulo principal ─────────────────────────────────────────────────────────

export default function ModuloExportacion() {
  const { usuario } = useAuth();
  const esCeo = usuario?.rol === 'CEO';
  const esAdmin = esCeo || usuario?.rol === 'TI' || usuario?.rol === 'Contable';

  const exportarCuentasCSV = useCallback(async () => {
    if (!usuario) return;
    const res = esAdmin ? await obtenerTodasLasCuentas() : await obtenerCuentasDeUsuario(usuario.id);
    if (!res.ok || !res.datos) throw new Error('Sin datos');
    descargarCSV(csvCuentas(res.datos), `cuentas_cobro_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [usuario, esAdmin]);

  const exportarCuentasPDF = useCallback(async () => {
    if (!usuario) return;
    const res = esAdmin ? await obtenerTodasLasCuentas() : await obtenerCuentasDeUsuario(usuario.id);
    if (!res.ok || !res.datos) throw new Error('Sin datos');
    abrirVentanaPDF(
      'Reporte de Cuentas de Cobro',
      esAdmin ? 'Todas las cuentas' : `Cuentas de ${usuario.nombreCompleto}`,
      pdfCuentas(res.datos),
    );
  }, [usuario, esAdmin]);

  const exportarBitacoraCSV = useCallback(async () => {
    if (!usuario) return;
    const res = esCeo ? await obtenerTodosLosRegistros() : await obtenerMisRegistros(usuario.id);
    if (!res.ok || !res.datos) throw new Error('Sin datos');
    descargarCSV(csvBitacora(res.datos), `bitacora_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [usuario, esCeo]);

  const exportarBitacoraPDF = useCallback(async () => {
    if (!usuario) return;
    const res = esCeo ? await obtenerTodosLosRegistros() : await obtenerMisRegistros(usuario.id);
    if (!res.ok || !res.datos) throw new Error('Sin datos');
    abrirVentanaPDF(
      'Reporte de Bitácora Estratégica',
      esCeo ? 'Todos los colaboradores' : `Registros de ${usuario.nombreCompleto}`,
      pdfBitacora(res.datos),
    );
  }, [usuario, esCeo]);

  if (!usuario) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>Exportación de Reportes</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Descarga reportes en CSV (para Excel) o PDF (para imprimir o archivar).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <TarjetaExport
          titulo="Cuentas de Cobro"
          descripcion={esAdmin ? 'Todas las cuentas radicadas en el sistema.' : 'Tus cuentas de cobro enviadas.'}
          icono={Download}
          colorIcono="#007a88"
          fondoIcono="rgba(0,122,136,0.1)"
          onCSV={exportarCuentasCSV}
          onPDF={exportarCuentasPDF}
        />
        <TarjetaExport
          titulo="Bitácora Estratégica"
          descripcion={esCeo ? 'Registros de todos los colaboradores.' : 'Tus registros de bitácora.'}
          icono={FileText}
          colorIcono="#7c3aed"
          fondoIcono="rgba(124,58,237,0.1)"
          onCSV={exportarBitacoraCSV}
          onPDF={exportarBitacoraPDF}
        />
      </div>

      <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'rgba(0,122,136,0.06)', border: '1px solid rgba(0,122,136,0.15)', color: 'var(--cd)' }}>
        <strong>Nota:</strong> Los archivos CSV se pueden abrir directamente en Microsoft Excel o Google Sheets. Los reportes PDF se abren en una nueva ventana del navegador para que puedas imprimirlos o guardarlos como PDF usando la función de impresión.
      </div>
    </div>
  );
}
