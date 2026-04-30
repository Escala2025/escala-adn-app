-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: notificaciones
-- Almacena notificaciones de eventos del sistema para cada usuario.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notificaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  para_usuario_id UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  de_usuario_id   UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo            VARCHAR(60) NOT NULL,    -- 'cuenta_pendiente' | 'cuenta_autorizada' | 'cuenta_rechazada' | 'comentario_ceo' | 'cuenta_enviada'
  titulo          VARCHAR(200) NOT NULL,
  descripcion     TEXT        NOT NULL,
  referencia_id   UUID,                    -- ID de la cuenta de cobro o bitácora relacionada
  leida           BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones(para_usuario_id, leida, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_notif_ref     ON notificaciones(referencia_id);

-- Trigger: crear notificación automáticamente cuando cambia el estado de una cuenta de cobro
CREATE OR REPLACE FUNCTION fn_notificar_cambio_cuenta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_titulo      TEXT;
  v_descripcion TEXT;
  v_tipo        TEXT;
BEGIN
  -- Solo actuar si el estado cambió
  IF OLD.estado = NEW.estado THEN RETURN NEW; END IF;

  CASE NEW.estado
    WHEN 'En revisión' THEN
      v_tipo        := 'cuenta_revision';
      v_titulo      := 'Cuenta en revisión';
      v_descripcion := 'Tu cuenta de cobro #' || NEW.numero_cuenta || ' está siendo revisada por Contabilidad.';
    WHEN 'Autorizado' THEN
      v_tipo        := 'cuenta_autorizada';
      v_titulo      := 'Cuenta autorizada';
      v_descripcion := 'Tu cuenta de cobro #' || NEW.numero_cuenta || ' fue autorizada por ' || COALESCE((SELECT nombre_completo FROM usuarios WHERE id = NEW.autorizado_por), 'el equipo') || '.';
    WHEN 'Rechazado' THEN
      v_tipo        := 'cuenta_rechazada';
      v_titulo      := 'Cuenta rechazada';
      v_descripcion := 'Tu cuenta de cobro #' || NEW.numero_cuenta || ' fue rechazada. Motivo: ' || COALESCE(NEW.motivo_rechazo, 'Sin especificar') || '.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO notificaciones (para_usuario_id, de_usuario_id, tipo, titulo, descripcion, referencia_id)
  VALUES (NEW.usuario_id, NEW.autorizado_por, v_tipo, v_titulo, v_descripcion, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_cuenta ON cuentas_cobro;
CREATE TRIGGER trg_notificar_cuenta
  AFTER UPDATE ON cuentas_cobro
  FOR EACH ROW EXECUTE FUNCTION fn_notificar_cuenta();
