-- =============================================================================
-- ESCALA ADN — Módulo: Bitácora Estratégica
-- Migración v2 — Nuevas tablas para el módulo de registro diario de actividades
-- Motor: PostgreSQL 15+
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLA: bitacora_registros
-- Registro diario por usuario. Cada fila = un día de trabajo.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bitacora_registros (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id          UUID            NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha               DATE            NOT NULL,
    porcentaje_avance   SMALLINT        NOT NULL DEFAULT 0
                        CHECK (porcentaje_avance BETWEEN 0 AND 100),
    estado_animico      VARCHAR(20)     NOT NULL DEFAULT 'Productivo'
                        CHECK (estado_animico IN ('Feliz','Productivo','Estresado','Agotado')),
    -- Feedback del CEO
    comentario_ceo      TEXT,
    comentario_leido    BOOLEAN         NOT NULL DEFAULT FALSE,
    comentado_en        TIMESTAMPTZ,
    -- Auditoría
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Un usuario solo puede tener un registro por día
    CONSTRAINT uq_bitacora_usuario_fecha UNIQUE (usuario_id, fecha)
);

COMMENT ON TABLE  bitacora_registros                    IS 'Registro diario de actividades por usuario — Módulo Bitácora Estratégica.';
COMMENT ON COLUMN bitacora_registros.estado_animico     IS 'Estado emocional del usuario al cierre del día.';
COMMENT ON COLUMN bitacora_registros.comentario_ceo     IS 'Feedback escrito por el CEO sobre el registro del usuario.';
COMMENT ON COLUMN bitacora_registros.comentario_leido   IS 'TRUE cuando el usuario vio el comentario del CEO.';

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario    ON bitacora_registros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha      ON bitacora_registros(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario_fecha ON bitacora_registros(usuario_id, fecha DESC);

-- -----------------------------------------------------------------------------
-- TABLA: bitacora_actividades
-- Líneas de detalle de cada registro (relación 1:N con bitacora_registros).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bitacora_actividades (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    registro_id     UUID            NOT NULL REFERENCES bitacora_registros(id) ON DELETE CASCADE,
    descripcion     TEXT            NOT NULL,
    horas           NUMERIC(4,1)    NOT NULL CHECK (horas > 0 AND horas <= 24),
    orden           SMALLINT        NOT NULL DEFAULT 1,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bitacora_actividades IS 'Actividades individuales dentro de un registro de bitácora. Cada registro puede tener N actividades.';

CREATE INDEX IF NOT EXISTS idx_bitacora_act_registro ON bitacora_actividades(registro_id);

-- -----------------------------------------------------------------------------
-- FUNCIÓN: Actualizar updated_at automáticamente
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_updated ON bitacora_registros;
CREATE TRIGGER trg_bitacora_updated
    BEFORE UPDATE ON bitacora_registros
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Garantiza a nivel de BD que cada usuario solo lee sus propios registros.
-- El CEO y TI pueden ver todo (se gestiona desde la application layer via
-- la action que llama con permiso total o filtrado por usuario_id).
-- -----------------------------------------------------------------------------

ALTER TABLE bitacora_registros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_actividades ENABLE ROW LEVEL SECURITY;

-- Política abierta a nivel de app (el filtrado lo hace la Server Action)
-- En producción, reemplazar con políticas basadas en current_setting('app.user_id')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'bitacora_registros_app_policy'
  ) THEN
    CREATE POLICY bitacora_registros_app_policy
      ON bitacora_registros FOR ALL USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'bitacora_actividades_app_policy'
  ) THEN
    CREATE POLICY bitacora_actividades_app_policy
      ON bitacora_actividades FOR ALL USING (TRUE);
  END IF;
END $$;
