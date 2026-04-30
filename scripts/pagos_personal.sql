-- =============================================================================
-- ESCALA ADN — Migración: Historial de Pagos del Personal
-- Tabla: pagos_personal
-- Descripción: Registro de pagos realizados a miembros del equipo interno.
--              Equivalente a transacciones_proveedores pero para colaboradores.
-- Motor: PostgreSQL 15+
-- Ejecutar: psql -U postgres -d escala_adn -f pagos_personal.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLA: pagos_personal
-- Historial de pagos a colaboradores. Inmutable por política de auditoría.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pagos_personal (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Colaborador al que se le realizó el pago
    usuario_id          UUID            NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    -- Monto en pesos colombianos
    valor_cop           BIGINT          NOT NULL CHECK (valor_cop > 0),
    concepto            TEXT            NOT NULL,
    numero_comprobante  VARCHAR(60),
    -- Tipo de pago: nómina, honorarios, bonificación, anticipo, etc.
    tipo_pago           VARCHAR(50)     NOT NULL DEFAULT 'Nomina'
                        CHECK (tipo_pago IN ('Nomina','Honorarios','Bonificacion','Anticipo','Liquidacion','Otro')),
    fecha_pago          DATE            NOT NULL,
    hora_pago           TIME,
    -- Periodo que cubre el pago (ej: "Enero 2025", "Q1 2025")
    periodo             VARCHAR(50),
    notas               TEXT,
    -- Usuario que registró el pago (debe ser CEO, TI o Contable)
    registrado_por      UUID            NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_pp_fecha_no_futura CHECK (fecha_pago <= CURRENT_DATE)
);

COMMENT ON TABLE  pagos_personal           IS 'Historial de pagos al personal interno. Inmutable por auditoría financiera.';
COMMENT ON COLUMN pagos_personal.valor_cop IS 'Valor en pesos colombianos (bigint, sin centavos).';
COMMENT ON COLUMN pagos_personal.tipo_pago IS 'Categoría del pago: Nomina, Honorarios, Bonificacion, Anticipo, Liquidacion, Otro.';

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_pp_usuario_id   ON pagos_personal(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pp_fecha_pago   ON pagos_personal(fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_pp_tipo_pago    ON pagos_personal(tipo_pago);
CREATE INDEX IF NOT EXISTS idx_pp_registrado   ON pagos_personal(registrado_por);

-- Trigger: impide modificar o eliminar pagos ya registrados
CREATE OR REPLACE FUNCTION fn_proteger_pagos_personal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Los pagos de personal son inmutables por política de auditoría financiera.';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los pagos de personal no pueden eliminarse. Registre un ajuste si aplica.';
    END IF;
    RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pp_proteger'
  ) THEN
    CREATE TRIGGER trg_pp_proteger
        BEFORE UPDATE OR DELETE ON pagos_personal
        FOR EACH ROW EXECUTE FUNCTION fn_proteger_pagos_personal();
  END IF;
END $$;
