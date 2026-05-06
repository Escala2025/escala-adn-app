-- ============================================================================
-- Escala ADN - Soporte de documentos obligatorios para proveedores
-- Requerimiento:
--   - 1 PDF por cada documento obligatorio
--   - impedir creación lógica "completa" si faltan documentos (se valida en app)
--   - tabla robusta para cargar, listar, descargar y actualizar documentos
-- ============================================================================

BEGIN;

-- 1) Tabla de documentos por proveedor
CREATE TABLE IF NOT EXISTS documentos_proveedor (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id     UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  tipo_documento   TEXT NOT NULL,
  nombre_archivo   TEXT NOT NULL,
  mime_type        TEXT NOT NULL DEFAULT 'application/pdf',
  contenido_base64 TEXT NOT NULL,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Solo tipos permitidos
  CONSTRAINT chk_documentos_proveedor_tipo
    CHECK (
      tipo_documento IN (
        'cedula_ciudadania',
        'rut',
        'hoja_vida_cv',
        'antecedentes_policia_procuraduria',
        'antecedentes_fiscales_contraloria',
        'referencias_comerciales_personales'
      )
    ),

  -- Solo PDF
  CONSTRAINT chk_documentos_proveedor_pdf
    CHECK (LOWER(mime_type) = 'application/pdf'),

  -- Evita filas vacías
  CONSTRAINT chk_documentos_proveedor_base64_no_vacio
    CHECK (length(trim(contenido_base64)) > 0),

  CONSTRAINT chk_documentos_proveedor_nombre_no_vacio
    CHECK (length(trim(nombre_archivo)) > 0)
);

-- 2) Un documento por tipo para cada proveedor (permite "actualizar" vía UPSERT)
CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_proveedor_tipo
  ON documentos_proveedor (proveedor_id, tipo_documento);

-- 3) Índice de consulta rápida por proveedor
CREATE INDEX IF NOT EXISTS ix_documentos_proveedor_proveedor
  ON documentos_proveedor (proveedor_id);

-- 4) Trigger para mantener actualizado_en
CREATE OR REPLACE FUNCTION set_actualizado_en_documentos_proveedor()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_actualizado_en_documentos_proveedor
ON documentos_proveedor;

CREATE TRIGGER trg_set_actualizado_en_documentos_proveedor
BEFORE UPDATE ON documentos_proveedor
FOR EACH ROW
EXECUTE FUNCTION set_actualizado_en_documentos_proveedor();

COMMIT;

-- ============================================================================
-- EJEMPLOS DE USO
-- ============================================================================

-- A) Crear / actualizar documento (UPSERT)
-- INSERT INTO documentos_proveedor
--   (proveedor_id, tipo_documento, nombre_archivo, mime_type, contenido_base64)
-- VALUES
--   ($1, 'rut', 'RUT_Proveedor.pdf', 'application/pdf', $2)
-- ON CONFLICT (proveedor_id, tipo_documento)
-- DO UPDATE SET
--   nombre_archivo   = EXCLUDED.nombre_archivo,
--   mime_type        = EXCLUDED.mime_type,
--   contenido_base64 = EXCLUDED.contenido_base64,
--   actualizado_en   = NOW();

-- B) Validar si un proveedor tiene los 6 obligatorios
-- SELECT
--   proveedor_id,
--   COUNT(DISTINCT tipo_documento) AS total_documentos
-- FROM documentos_proveedor
-- WHERE proveedor_id = $1
-- GROUP BY proveedor_id;

-- C) Listar documentos de un proveedor
-- SELECT id, proveedor_id, tipo_documento, nombre_archivo, mime_type, creado_en, actualizado_en
-- FROM documentos_proveedor
-- WHERE proveedor_id = $1
-- ORDER BY tipo_documento;
