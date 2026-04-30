-- =============================================================================
-- SEED: Usuario TI — Maicol Andres Betancur
-- Ejecutar UNA sola vez después del script principal escala_adn_database.sql
-- Este script es IDEMPOTENTE: si el usuario ya existe lo actualiza, no duplica.
-- =============================================================================

DO $$
DECLARE
  v_rol_id   SMALLINT;
  v_hash     TEXT;
BEGIN
  -- Obtener el id del rol TI
  SELECT id INTO v_rol_id FROM roles WHERE nombre = 'TI' LIMIT 1;

  IF v_rol_id IS NULL THEN
    RAISE EXCEPTION 'Rol TI no encontrado. Ejecuta primero escala_adn_database.sql';
  END IF;

  -- Hash bcrypt de "Escala2024*" (cost=12)
  -- Para cambiarlo ejecuta: SELECT crypt('nueva_clave', gen_salt('bf',12));
  v_hash := '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBpj2BpOY6CKVa';

  INSERT INTO usuarios (
    nombre_completo,
    correo,
    hash_contrasena,
    rol_id,
    cargo,
    activo
  )
  VALUES (
    'Maicol Andres Betancur',
    'soporteti@escala.edu.co',
    v_hash,
    v_rol_id,
    'Soporte TI',
    TRUE
  )
  ON CONFLICT (correo) DO UPDATE
    SET nombre_completo = EXCLUDED.nombre_completo,
        cargo           = EXCLUDED.cargo,
        activo          = TRUE;

  RAISE NOTICE 'Usuario TI creado/actualizado: soporteti@escala.edu.co';
END $$;
