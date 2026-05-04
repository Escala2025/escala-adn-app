-- =============================================================================
-- ESCALA ADN — Mejoras: Perfil editable, Auditoría de acciones, Sesiones activas
-- Motor: PostgreSQL 15+
-- Ejecutar: psql -U postgres -d escala_adn -f scripts/perfil_auditoria_sesiones.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnas adicionales en usuarios (perfil editable)
--    foto_url:       URL pública del avatar subido (puede ser NULL; se usa avatar de iniciales)
--    nombre_visible: Nombre corto/alias que el usuario prefiere mostrar
-- -----------------------------------------------------------------------------

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS foto_url       TEXT,
  ADD COLUMN IF NOT EXISTS nombre_visible VARCHAR(60);

COMMENT ON COLUMN usuarios.foto_url       IS 'URL de avatar personalizado. NULL = usar iniciales como fallback.';
COMMENT ON COLUMN usuarios.nombre_visible IS 'Nombre corto o alias preferido. Si es NULL se usa nombre_completo.';

-- -----------------------------------------------------------------------------
-- 2. TABLA: auditoria_acciones
--    Registro inmutable de cada acción relevante en el sistema.
--    Solo CEO y TI pueden consultarla. No se borra ni modifica (INSERT only).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auditoria_acciones (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID            REFERENCES usuarios(id) ON DELETE SET NULL,
    -- Nombre snapshot — no se pierde si el usuario es eliminado
    nombre_usuario  VARCHAR(150),
    rol_usuario     VARCHAR(30),
    -- Módulo o entidad afectada (ej: 'cobros', 'usuarios', 'credenciales')
    modulo          VARCHAR(60)     NOT NULL,
    -- Acción realizada (ej: 'crear', 'aprobar', 'rechazar', 'eliminar', 'login')
    accion          VARCHAR(80)     NOT NULL,
    -- Descripción legible para humanos
    descripcion     TEXT,
    -- ID del registro afectado (opcional)
    referencia_id   UUID,
    -- Metadatos de contexto
    ip_origen       INET,
    user_agent      TEXT,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existía de una versión previa, completar columnas faltantes.
ALTER TABLE auditoria_acciones
  ADD COLUMN IF NOT EXISTS usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nombre_usuario VARCHAR(150),
  ADD COLUMN IF NOT EXISTS rol_usuario    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS modulo         VARCHAR(60),
  ADD COLUMN IF NOT EXISTS accion         VARCHAR(80),
  ADD COLUMN IF NOT EXISTS descripcion    TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id  UUID,
  ADD COLUMN IF NOT EXISTS ip_origen      INET,
  ADD COLUMN IF NOT EXISTS user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS creado_en      TIMESTAMPTZ;

ALTER TABLE auditoria_acciones
  ALTER COLUMN modulo SET NOT NULL,
  ALTER COLUMN accion SET NOT NULL,
  ALTER COLUMN creado_en SET DEFAULT NOW();

COMMENT ON TABLE  auditoria_acciones IS 'Log inmutable de acciones del sistema. Solo lectura para CEO/TI.';
COMMENT ON COLUMN auditoria_acciones.nombre_usuario IS 'Snapshot del nombre al momento de la acción — persiste aunque se elimine el usuario.';

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria_acciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo     ON auditoria_acciones(modulo);
CREATE INDEX IF NOT EXISTS idx_auditoria_creado_en  ON auditoria_acciones(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion     ON auditoria_acciones(accion);

-- Proteger contra UPDATE y DELETE (tabla append-only)
CREATE OR REPLACE RULE auditoria_no_update AS ON UPDATE TO auditoria_acciones DO INSTEAD NOTHING;
CREATE OR REPLACE RULE auditoria_no_delete AS ON DELETE TO auditoria_acciones DO INSTEAD NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Mejorar tabla sesiones_jwt para soportar sesiones activas
--    Agregar columna nombre_dispositivo para identificar mejor cada sesión.
-- -----------------------------------------------------------------------------

ALTER TABLE sesiones_jwt
  ADD COLUMN IF NOT EXISTS nombre_dispositivo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cerrada_en          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cerrada_por_usuario BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN sesiones_jwt.nombre_dispositivo    IS 'Ej: "Chrome en Windows", "Safari en iPhone". Derivado del user_agent.';
COMMENT ON COLUMN sesiones_jwt.cerrada_en            IS 'Timestamp de cierre explícito (logout o cierre remoto).';
COMMENT ON COLUMN sesiones_jwt.cerrada_por_usuario   IS 'TRUE si el usuario la cerró manualmente (vs expiración automática).';
