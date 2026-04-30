// Helpers síncronos para documentos personal.
// Este archivo NO tiene "use server" — exporta funciones síncronas puras.

import type { TipoDocumentoPersonal } from '@/lib/tipos';
export type { TipoDocumentoPersonal };

export interface DatosPDFCuenta {
  numeroCuenta: string;
  nombreSolicitante: string;
  cedulaSolicitante: string;
  valorNumerico: number | string;
  valorLetras: string;
  concepto: string;
  centroCostos: string;
  banco: string;
  tipoCuenta: string;
  numeroCuentaBancaria: string;
  titular: string;
  fechaDocumento: string;
  declaranteRenta: boolean;
}

export function generarNombreArchivo(
  nombreSolicitante: string,
  tipo: TipoDocumentoPersonal,
  fecha: string,
): string {
  const nombre = nombreSolicitante
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 20);
  const tipos: Record<TipoDocumentoPersonal, string> = {
    seg_social:       'SegSocial',
    cert_bancario:    'CertBancario',
    cuenta_cobro_pdf: 'CuentaCobro',
  };
  return `${nombre}_${tipos[tipo]}_${fecha}`;
}

export function generarPDFCuentaCobroBase64(d: DatosPDFCuenta): string {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Cuenta de Cobro</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#1a2e3b;padding:32px}
h1{font-size:18px;color:#007a88;border-bottom:2px solid #007a88;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:16px}
td{padding:6px 10px;border:1px solid #d0d9dd}
.label{font-weight:bold;background:#f0f5f7;width:40%}
.valor-total{font-size:16px;font-weight:bold;color:#007a88}</style></head>
<body><h1>CUENTA DE COBRO No. ${d.numeroCuenta}</h1>
<table>
<tr><td class="label">Nombre</td><td>${d.nombreSolicitante}</td></tr>
<tr><td class="label">Cedula</td><td>${d.cedulaSolicitante}</td></tr>
<tr><td class="label">Fecha</td><td>${d.fechaDocumento}</td></tr>
<tr><td class="label">Concepto</td><td>${d.concepto}</td></tr>
<tr><td class="label">Centro de Costos</td><td>${d.centroCostos}</td></tr>
<tr><td class="label">Valor</td><td class="valor-total">$${Number(d.valorNumerico).toLocaleString('es-CO')}</td></tr>
<tr><td class="label">Son</td><td>${d.valorLetras}</td></tr>
<tr><td class="label">Banco</td><td>${d.banco}</td></tr>
<tr><td class="label">Tipo de Cuenta</td><td>${d.tipoCuenta}</td></tr>
<tr><td class="label">No. Cuenta</td><td>${d.numeroCuentaBancaria}</td></tr>
<tr><td class="label">Titular</td><td>${d.titular}</td></tr>
<tr><td class="label">Declarante de Renta</td><td>${d.declaranteRenta ? 'Si' : 'No'}</td></tr>
</table></body></html>`;
  return Buffer.from(html, 'utf-8').toString('base64');
}
