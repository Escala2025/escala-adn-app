-- ─────────────────────────────────────────────────────────────────────────────
-- MÓDULO: DOCUMENTOS PERSONAL
-- Tabla que almacena copias de los documentos adjuntos en cuentas de cobro
-- más el PDF generado automáticamente. Sirve como repositorio permanente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documentos_personal (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id       UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- FK opcional a la cuenta de cobro de origen. SET NULL si se borra la cuenta.
  cuenta_cobro_id  UUID        REFERENCES cuentas_cobro(id) ON DELETE SET NULL,
  -- Nombre visible con formato: NombreApellido_TipoDoc_YYYY-MM-DD
  nombre_archivo   VARCHAR(255) NOT NULL,
  -- 'seg_social' | 'cert_bancario' | 'cuenta_cobro_pdf'
  tipo_documento   VARCHAR(50)  NOT NULL,
  -- Contenido completo en base64 (data:application/pdf;base64,... o image/...)
  contenido_base64 TEXT         NOT NULL,
  mime_type        VARCHAR(80)  NOT NULL DEFAULT 'application/pdf',
  -- Soft-delete con auditoría completa
  borrado          BOOLEAN      NOT NULL DEFAULT FALSE,
  borrado_por      UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  borrado_en       TIMESTAMPTZ,
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_docs_usuario    ON documentos_personal(usuario_id) WHERE borrado = FALSE;
CREATE INDEX IF NOT EXISTS idx_docs_cuenta     ON documentos_personal(cuenta_cobro_id);
CREATE INDEX IF NOT EXISTS idx_docs_tipo       ON documentos_personal(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_docs_creado_en  ON documentos_personal(creado_en DESC);

-- Comentarios de columnas
COMMENT ON TABLE  documentos_personal               IS 'Repositorio permanente de documentos por colaborador, generados desde cuentas de cobro.';
COMMENT ON COLUMN documentos_personal.nombre_archivo IS 'Formato: PrimerNombrePrimerApellido_TipoDoc_YYYY-MM-DD.ext';
COMMENT ON COLUMN documentos_personal.tipo_documento IS 'seg_social | cert_bancario | cuenta_cobro_pdf';
COMMENT ON COLUMN documentos_personal.borrado_por    IS 'UUID del usuario que eliminó el documento (trazabilidad).';
