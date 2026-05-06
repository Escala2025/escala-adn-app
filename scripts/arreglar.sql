BEGIN;

-- 1) Diagnóstico inicial
SELECT centro_costos, COUNT(*) AS total
FROM cuentas_cobro
GROUP BY centro_costos
ORDER BY total DESC, centro_costos;

-- 2) Normalización básica (trim + espacios múltiples)
UPDATE cuentas_cobro
SET centro_costos = regexp_replace(btrim(centro_costos), '\s+', ' ', 'g')
WHERE centro_costos IS NOT NULL;

-- 3) Mapeo de valores históricos comunes -> catálogo permitido
-- (Ajusta estos mapeos si en tu operación prefieres otro destino)

UPDATE cuentas_cobro
SET centro_costos = 'Escala General'
WHERE lower(centro_costos) IN (
  'marketing y comunicaciones',
  'marketing',
  'comunicaciones',
  'general',
  'escala'
);

UPDATE cuentas_cobro
SET centro_costos = 'Escala Base'
WHERE lower(centro_costos) IN (
  'escala base ',
  'base',
  'escala-base'
);

UPDATE cuentas_cobro
SET centro_costos = 'Comfandi'
WHERE lower(centro_costos) IN (
  'comfandi ',
  'comfandy'
);

UPDATE cuentas_cobro
SET centro_costos = 'Alianza Fortalecimiento emprendedores'
WHERE lower(centro_costos) IN (
  'alianza fortalecimiento emprendedores ',
  'alianza emprendimiento',
  'fortalecimiento emprendedores'
);

UPDATE cuentas_cobro
SET centro_costos = 'Caribe Exponencial'
WHERE lower(centro_costos) IN (
  'caribe exponencial ',
  'caribe'
);

UPDATE cuentas_cobro
SET centro_costos = 'Ruta emprendimiento 2026'
WHERE lower(centro_costos) IN (
  'ruta emprendimiento',
  'ruta emprendimiento 2026 ',
  'ruta 2026'
);

-- 4) Fallback conservador para cualquier inválido restante
-- (si prefieres NO forzar, comenta este bloque y revisa manualmente)
UPDATE cuentas_cobro
SET centro_costos = 'Escala General'
WHERE centro_costos IS NULL
   OR btrim(centro_costos) = ''
   OR centro_costos NOT IN (
      'Comfandi',
      'Escala Base',
      'Escala General',
      'Alianza Fortalecimiento emprendedores',
      'Caribe Exponencial',
      'Ruta emprendimiento 2026'
   );

-- 5) Verificación previa al constraint (debe devolver 0)
SELECT COUNT(*) AS invalidos_restantes
FROM cuentas_cobro
WHERE centro_costos IS NULL
   OR btrim(centro_costos) = ''
   OR centro_costos NOT IN (
      'Comfandi',
      'Escala Base',
      'Escala General',
      'Alianza Fortalecimiento emprendedores',
      'Caribe Exponencial',
      'Ruta emprendimiento 2026'
   );

-- 6) Crear constraint (si ya existe, elimínalo primero)
ALTER TABLE cuentas_cobro
  DROP CONSTRAINT IF EXISTS chk_cuentas_cobro_centro_costos;

ALTER TABLE cuentas_cobro
  ADD CONSTRAINT chk_cuentas_cobro_centro_costos
  CHECK (
    centro_costos IN (
      'Comfandi',
      'Escala Base',
      'Escala General',
      'Alianza Fortalecimiento emprendedores',
      'Caribe Exponencial',
      'Ruta emprendimiento 2026'
    )
  );

COMMIT;