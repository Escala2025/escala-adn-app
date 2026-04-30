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

  // 2. Obtener de la BD (Asegúrate que el campo es contenido_base64)
  const rows = await query<{
    nombre_archivo:   string;
    tipo_documento:   string;
    contenido_base64: string;
    mime_type:        string;
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

  // 3. Limpiar el Base64
  let base64Puro = doc.contenido_base64;
  if (base64Puro.startsWith('data:')) {
    const indiceComa = base64Puro.indexOf(',');
    if (indiceComa !== -1) {
      base64Puro = base64Puro.slice(indiceComa + 1);
    }
  }

  const base64Limpio = base64Puro.replace(/[\r\n\s]/g, '');

  // 4. DECODIFICAR Y CONVERTIR A UINT8ARRAY (Vital para TypeScript y el Build)
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Limpio, 'base64');
  } catch {
    return new NextResponse('Contenido corrupto', { status: 422 });
  }

  // Convertimos el Buffer de Node a un Uint8Array estándar de Web para evitar errores de tipo
  const cuerpoArchivo = new Uint8Array(buffer);

  // 5. Determinar el nombre y MIME
  // IMPORTANTE: Si es una cuenta de cobro generada por nosotros, forzamos application/pdf
  let mimeFinal = doc.mime_type;
  if (doc.tipo_documento === 'cuenta_cobro_pdf') {
    mimeFinal = 'application/pdf';
  }

  const nombreDescarga = doc.nombre_archivo.toLowerCase().endsWith('.pdf')
    ? doc.nombre_archivo
    : `${doc.nombre_archivo}.pdf`;

  // 6. Respuesta final
  return new NextResponse(cuerpoArchivo, {
    status: 200,
    headers: {
      'Content-Type': mimeFinal || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nombreDescarga)}"`,
      'Content-Length': String(cuerpoArchivo.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}