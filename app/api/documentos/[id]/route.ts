import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Validar UUID
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return new NextResponse('ID inválido', { status: 400 });
  }

  // 2. Obtener de la BD
  const rows = await query<{
    nombre_archivo: string;
    tipo_documento: string;
    contenido_base64: string;
    mime_type: string;
  }>(
    `SELECT nombre_archivo, tipo_documento, contenido_base64, mime_type
     FROM documentos_personal
     WHERE id = $1 AND borrado = FALSE
     LIMIT 1`,
    [id],
  ).catch(() => []);

  const doc = rows[0];

  if (!doc) {
    return new NextResponse('Documento no encontrado', { status: 404 });
  }

  // 3. Limpiar base64
  let base64Puro = doc.contenido_base64;
  if (base64Puro.startsWith('data:')) {
    const indiceComa = base64Puro.indexOf(',');
    if (indiceComa !== -1) {
      base64Puro = base64Puro.slice(indiceComa + 1);
    }
  }

  const base64Limpio = base64Puro.replace(/[\r\n\s]/g, '');

  // 4. Decodificar
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Limpio, 'base64');
  } catch {
    return new NextResponse('Contenido corrupto', { status: 422 });
  }

  if (!buffer || buffer.byteLength === 0) {
    return new NextResponse('Contenido vacío', { status: 422 });
  }

  const cuerpoArchivo = new Uint8Array(buffer);

  // 5. Detectar tipo real
  const esPDFReal = buffer.byteLength >= 4
    && buffer[0] === 0x25
    && buffer[1] === 0x50
    && buffer[2] === 0x44
    && buffer[3] === 0x46;

  let mimeFinal = doc.mime_type || 'application/octet-stream';
  if (doc.tipo_documento === 'cuenta_cobro_pdf') {
    // Requerimiento funcional: siempre descargar cuenta de cobro como PDF
    mimeFinal = 'application/pdf';
  }

  const nombreBase = doc.nombre_archivo.replace(/\.(pdf|html?)$/i, '');
  const nombreDescarga = doc.tipo_documento === 'cuenta_cobro_pdf'
    ? `${nombreBase}.pdf`
    : (/\.(pdf|html?)$/i.test(doc.nombre_archivo) ? doc.nombre_archivo : `${doc.nombre_archivo}.pdf`);

  // 6. Respuesta
  return new NextResponse(cuerpoArchivo, {
    status: 200,
    headers: {
      'Content-Type': mimeFinal,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nombreDescarga)}"; filename*=UTF-8''${encodeURIComponent(nombreDescarga)}`,
      'Content-Length': String(cuerpoArchivo.byteLength),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
