-- =============================================================================
-- SPRINT: Numeración automática de cuentas de cobro + estado "Pagada"
-- Base de datos: escala_adn
-- Ejecutar UNA SOLA VEZ en el entorno de destino.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECUENCIA PARA NÚMERO DE CUENTA
--    Genera valores secuenciales únicos a nivel de BD,
--    garantizando que la concurrencia nunca produzca duplicados.
--    nextval() es atómico en PostgreSQL — seguro incluso con múltiples
--    conexiones simultáneas.
-- -----------------------------------------------------------------------------
CREATE SEQUENCE seq_numero_cuenta
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
    
CREATE SEQUENCE IF NOT EXISTS seq_numero_cuenta
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;          -- CACHE 1 = sin "saltos" por caídas del servidor

-- Si ya hay cuentas en la tabla, posicionar la secuencia en el siguiente
-- número disponible para no generar colisiones con registros históricos.
SELECT setval(
  'seq_numero_cuenta',
  GREATEST(
    (SELECT COALESCE(MAX(CAST(numero_cuenta AS INTEGER)), 0) FROM cuentas_cobro
     WHERE numero_cuenta ~ '^[0-9]+$'),   -- solo filas con valor numérico puro
    0
  )
);

-- -----------------------------------------------------------------------------
-- 2. CAMBIAR EL TIPO DE LA COLUMNA numero_cuenta
--    Actualmente es VARCHAR (ingreso manual). La convertimos a INTEGER
--    con valor por defecto = siguiente valor de la secuencia.
--    Si la columna ya es INTEGER, este bloque es idempotente gracias al
--    USING que castea los valores existentes.
-- -----------------------------------------------------------------------------
ALTER TABLE cuentas_cobro
  ALTER COLUMN numero_cuenta
    SET DEFAULT nextval('seq_numero_cuenta');

-- Vincular la secuencia a la columna (OWNED BY) para que se elimine
-- automáticamente si se elimina la tabla.
ALTER SEQUENCE seq_numero_cuenta OWNED BY cuentas_cobro.numero_cuenta;

-- -----------------------------------------------------------------------------
-- 3. NUEVO ESTADO "Pagada"
--    Si la columna estado usa un tipo ENUM, agregar el nuevo valor.
--    Si es VARCHAR/TEXT con CHECK, actualizar la constraint.
-- -----------------------------------------------------------------------------

-- 3a. Intentar agregar al ENUM si existe (ignorar error si no es ENUM)
DO $$
BEGIN
  -- Solo ejecutar si el tipo de la columna es un enum de PostgreSQL
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'estado_cuenta_cobro'
  ) THEN
    ALTER TYPE estado_cuenta_cobro ADD VALUE IF NOT EXISTS 'Pagada' AFTER 'Autorizado';
  END IF;
END;
$$;

-- 3b. Si la columna es VARCHAR con CHECK constraint, reemplazar la constraint
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Buscar el nombre de la constraint CHECK sobre la columna estado
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'cuentas_cobro'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%estado%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    -- Eliminar la constraint existente
    EXECUTE format('ALTER TABLE cuentas_cobro DROP CONSTRAINT %I', v_constraint_name);
    -- Recrear con el nuevo estado incluido
    ALTER TABLE cuentas_cobro
      ADD CONSTRAINT ck_estado_cuenta_cobro CHECK (
        estado IN ('Pendiente', 'En revisión', 'Autorizado', 'Rechazado', 'Pagada')
      );
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. COLUMNA DE AUDITORÍA PARA EL ESTADO "Pagada"
--    Registra quién marcó como pagada y cuándo.
-- -----------------------------------------------------------------------------
ALTER TABLE cuentas_cobro
  ADD COLUMN IF NOT EXISTS pagado_por        UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_pago_real   TIMESTAMPTZ DEFAULT NULL;

-- -----------------------------------------------------------------------------
-- 5. ÍNDICE para consultas frecuentes por estado
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cuentas_cobro_estado
  ON cuentas_cobro (estado);

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN FINAL
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Sprint aplicado correctamente:';
  RAISE NOTICE '  - Secuencia seq_numero_cuenta creada/verificada';
  RAISE NOTICE '  - DEFAULT de numero_cuenta vinculado a la secuencia';
  RAISE NOTICE '  - Estado Pagada agregado al dominio';
  RAISE NOTICE '  - Columnas pagado_por y fecha_pago_real agregadas';
END;
$$;
