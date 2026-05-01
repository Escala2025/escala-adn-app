-- =============================================================================
-- FIX: Saneamiento de documentos no PDF en documentos_personal
-- Objetivo:
--   Detectar y marcar como borrados los registros de seg_social/cert_bancario
--   que fueron guardados con contenido tipo imagen en vez de PDF.
--
-- Modo conservador:
--   - Incluye exactamente el diagnóstico y soft-delete solicitados.
--   - NO elimina físicamente registros (soft-delete solamente).
--
-- Ejecutar:
--   psql -U postgres -d escala_adn -f scripts/fix_documentos_no_pdf.sql
-- =============================================================================

-- 1) Diagnóstico: candidatos inválidos para seg_social / cert_bancario
SELECT id, tipo_documento, nombre_archivo, mime_type, LEFT(contenido_base64, 40) AS inicio
FROM documentos_personal
WHERE borrado = FALSE
  AND tipo_documento IN ('seg_social', 'cert_bancario')
  AND (
    contenido_base64 ILIKE 'data:image/%'
    OR LEFT(REPLACE(REPLACE(REPLACE(contenido_base64, E'\n',''), E'\r',''), ' ', ''), 4) <> 'JVBE'
  );

-- 2) Soft-delete conservador: solo payloads claramente image/*
UPDATE documentos_personal
SET borrado = TRUE, borrado_en = NOW()
WHERE borrado = FALSE
  AND tipo_documento IN ('seg_social', 'cert_bancario')
  AND contenido_base64 ILIKE 'data:image/%';

-- 3) Verificación rápida post-fix (opcional)
SELECT
  COUNT(*) AS restantes_con_data_image
FROM documentos_personal
WHERE borrado = FALSE
  AND tipo_documento IN ('seg_social', 'cert_bancario')
  AND contenido_base64 ILIKE 'data:image/%';
