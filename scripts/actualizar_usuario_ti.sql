-- =============================================================================
-- ACTUALIZACIÓN USUARIO SUPERADMINISTRADOR TI
-- =============================================================================
-- Actualiza el nombre del usuario TI por defecto a Maicol Andres Betancur.
-- Correo de acceso: soporteti@escala.edu.co  (no cambia)
-- Contraseña:       Escala2026*              (no cambia)
--
-- Ejecutar UNA sola vez en el entorno de destino:
--   psql -U postgres -d escala_adn -f scripts/actualizar_usuario_ti.sql
-- =============================================================================

UPDATE usuarios
SET
    nombre_completo = 'Maicol Andres Betancur',
    cargo           = 'Coordinador TI — Superadministrador',
    actualizado_en  = NOW()
WHERE correo = 'soporteti@escala.edu.co';

-- Verificar el resultado
SELECT id, nombre_completo, correo, cargo, activo
FROM   usuarios
WHERE  correo = 'soporteti@escala.edu.co';
