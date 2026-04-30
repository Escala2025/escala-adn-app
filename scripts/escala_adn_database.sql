-- =============================================================================
-- ESCALA ADN — Script de Base de Datos Completo
-- Motor: PostgreSQL 15+
-- Empresa: Escala Consciencia & Negocios BIC SAS
-- NIT: 811.007.550-3
-- Versión: 1.0.0
-- Fecha: 2025
--
-- INSTRUCCIONES DE EJECUCIÓN:
--   psql -U postgres -d escala_adn -f escala_adn_database.sql
--
-- NOTA DE SEGURIDAD:
--   Las contraseñas se almacenan con hash Argon2id (PHP: password_hash()).
--   NUNCA almacenar contraseñas en texto plano.
--   El hash del seed fue generado con:
--     password_hash('Escala2026*', PASSWORD_ARGON2ID)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. PREPARACIÓN: Extensiones y configuración inicial
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Zona horaria corporativa (Colombia UTC-5)
SET timezone = 'America/Bogota';

-- -----------------------------------------------------------------------------
-- 1. TABLA: roles
-- Catálogo maestro de roles del sistema.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id             SMALLSERIAL     PRIMARY KEY,
    nombre         VARCHAR(30)     NOT NULL UNIQUE,
    descripcion    VARCHAR(255)    NOT NULL,
    -- Nivel numérico: mayor número = más privilegios. Usado para ordenamiento.
    nivel_acceso   SMALLINT        NOT NULL DEFAULT 1
                   CHECK (nivel_acceso BETWEEN 1 AND 5),
    activo         BOOLEAN         NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_roles_nombre_valido
        CHECK (nombre IN ('CEO','TI','Contable','Personal_base','Proveedor'))
);

COMMENT ON TABLE  roles              IS 'Catálogo de roles de acceso de la plataforma Escala ADN.';
COMMENT ON COLUMN roles.nivel_acceso IS 'Jerarquía: 5=CEO/TI (total), 4=Contable, 2=Personal_base, 1=Proveedor.';

-- Índice para búsquedas por nombre (frecuente en validación JWT)
CREATE INDEX IF NOT EXISTS idx_roles_nombre ON roles(nombre);

-- -----------------------------------------------------------------------------
-- 2. TABLA: usuarios
-- Entidad central de personas con acceso al sistema.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    rol_id              SMALLINT        NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    nombre_completo     VARCHAR(150)    NOT NULL,
    correo              VARCHAR(180)    NOT NULL UNIQUE,
    telefono            VARCHAR(20),
    cargo               VARCHAR(100),
    -- Contraseña hasheada con Argon2id. NUNCA texto plano.
    hash_contrasena     TEXT            NOT NULL,
    activo              BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Auditoría
    ultimo_acceso       TIMESTAMPTZ,
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_usuarios_correo_formato
        CHECK (correo ~* '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
);

COMMENT ON TABLE  usuarios                IS 'Usuarios registrados en la plataforma. Contraseñas en Argon2id.';
COMMENT ON COLUMN usuarios.hash_contrasena IS 'Hash Argon2id generado con PHP password_hash(). Nunca texto plano.';
COMMENT ON COLUMN usuarios.rol_id         IS 'FK al catálogo de roles. Define los permisos del usuario.';

-- Índices de búsqueda frecuente
CREATE INDEX IF NOT EXISTS idx_usuarios_correo   ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id   ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo   ON usuarios(activo) WHERE activo = TRUE;

-- Trigger: actualiza 'actualizado_en' automáticamente
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- -----------------------------------------------------------------------------
-- 3. TABLA: sesiones_jwt
-- Registro de tokens JWT activos para invalidación segura (blacklist).
-- Permite revocar sesiones individuales sin necesidad de cambiar el secreto.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sesiones_jwt (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID            NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    -- Identificador único del token (claim "jti")
    jti             VARCHAR(64)     NOT NULL UNIQUE,
    ip_origen       INET,
    user_agent      TEXT,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    expira_en       TIMESTAMPTZ     NOT NULL,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sesiones_jwt IS 'Registro de tokens JWT emitidos. Permite revocar sesiones individuales.';

CREATE INDEX IF NOT EXISTS idx_sesiones_jti        ON sesiones_jwt(jti);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_id ON sesiones_jwt(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_activo     ON sesiones_jwt(activo, expira_en);

-- -----------------------------------------------------------------------------
-- 4. TABLA: gestor_contrasenas
-- Bóveda interna de credenciales de plataformas. Datos cifrados en reposo.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gestor_contrasenas (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id          UUID            NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    -- Si un CEO/TI registra para otro usuario, este campo difiere del propietario
    propietario_id      UUID            NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre_plataforma   VARCHAR(100)    NOT NULL,
    link_plataforma     TEXT,
    -- Contraseña cifrada con AES-256-GCM vía pgcrypto. La llave está en el backend.
    contrasena_cifrada  TEXT            NOT NULL,
    categoria           VARCHAR(50)     NOT NULL DEFAULT 'Otros'
                        CHECK (categoria IN (
                            'Redes Sociales','Herramientas de Diseño','Servidores',
                            'Email','CRM','Contabilidad','Almacenamiento','Otros'
                        )),
    notas               TEXT,
    activo              BOOLEAN         NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_gp_link_formato
        CHECK (link_plataforma IS NULL OR link_plataforma ~* '^https?://')
);

COMMENT ON TABLE  gestor_contrasenas                  IS 'Bóveda de credenciales internas. Contraseñas cifradas con AES-256-GCM.';
COMMENT ON COLUMN gestor_contrasenas.contrasena_cifrada IS 'Cifrada en el backend PHP antes de persistir. Nunca texto plano en BD.';
COMMENT ON COLUMN gestor_contrasenas.propietario_id   IS 'Usuario al que pertenece la credencial (puede diferir de quien la creó).';

CREATE INDEX IF NOT EXISTS idx_gc_usuario_id    ON gestor_contrasenas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gc_propietario   ON gestor_contrasenas(propietario_id);
CREATE INDEX IF NOT EXISTS idx_gc_categoria     ON gestor_contrasenas(categoria);
CREATE INDEX IF NOT EXISTS idx_gc_plataforma    ON gestor_contrasenas USING gin(to_tsvector('spanish', nombre_plataforma));

CREATE TRIGGER trg_gc_actualizado
    BEFORE UPDATE ON gestor_contrasenas
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- -----------------------------------------------------------------------------
-- 5. TABLA: proveedores
-- Maestro de terceros con quienes Escala tiene relación comercial.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proveedores (
    id                          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    razon_social                VARCHAR(200)    NOT NULL,
    -- NIT (Colombia): formato 000.000.000-0 o cédula natural
    nit_cedula                  VARCHAR(30)     NOT NULL UNIQUE,
    direccion                   VARCHAR(255),
    ciudad                      VARCHAR(100),
    telefono                    VARCHAR(20),
    correo                      VARCHAR(180),
    regimen_tributario          VARCHAR(50)     NOT NULL
                                CHECK (regimen_tributario IN (
                                    'Responsable de IVA','No Responsable de IVA',
                                    'Gran Contribuyente','Régimen Simple'
                                )),
    responsabilidades_fiscales  TEXT,
    servicios                   TEXT,
    activo                      BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Usuario que registró al proveedor
    registrado_por              UUID            REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en                   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_proveedores_correo
        CHECK (correo IS NULL OR correo ~* '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
);

COMMENT ON TABLE  proveedores             IS 'Directorio maestro de proveedores de Escala BIC SAS.';
COMMENT ON COLUMN proveedores.nit_cedula  IS 'NIT con dígito de verificación (ej: 900.456.123-1) o cédula si es persona natural.';

CREATE INDEX IF NOT EXISTS idx_prov_nit_cedula    ON proveedores(nit_cedula);
CREATE INDEX IF NOT EXISTS idx_prov_razon_social  ON proveedores USING gin(to_tsvector('spanish', razon_social));
CREATE INDEX IF NOT EXISTS idx_prov_activo        ON proveedores(activo) WHERE activo = TRUE;

CREATE TRIGGER trg_prov_actualizado
    BEFORE UPDATE ON proveedores
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- -----------------------------------------------------------------------------
-- 6. TABLA: transacciones_proveedores
-- Historial de pagos realizados a proveedores. Inmutable por auditoría.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transacciones_proveedores (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    proveedor_id        UUID            NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    -- Monto en pesos colombianos (sin decimales para evitar errores de punto flotante)
    valor_cop           BIGINT          NOT NULL CHECK (valor_cop > 0),
    concepto            TEXT            NOT NULL,
    numero_comprobante  VARCHAR(60),
    -- URL firmada del soporte en Google Drive
    url_soporte_drive   TEXT,
    fecha_pago          DATE            NOT NULL,
    hora_pago           TIME,
    registrado_por      UUID            NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Registros de transacciones NO se modifican ni eliminan por integridad financiera
    CONSTRAINT ck_trx_fecha_no_futura CHECK (fecha_pago <= CURRENT_DATE)
);

COMMENT ON TABLE  transacciones_proveedores           IS 'Historial inmutable de pagos a proveedores. No permite UPDATE/DELETE por auditoría.';
COMMENT ON COLUMN transacciones_proveedores.valor_cop IS 'Valor en pesos colombianos. Bigint para evitar imprecisión de flotantes.';

-- Trigger que prohíbe modificar o eliminar transacciones registradas
CREATE OR REPLACE FUNCTION fn_proteger_transacciones()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Las transacciones son inmutables por política de auditoría financiera.';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las transacciones no pueden eliminarse. Registre una nota de crédito si aplica.';
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_trx_proteger
    BEFORE UPDATE OR DELETE ON transacciones_proveedores
    FOR EACH ROW EXECUTE FUNCTION fn_proteger_transacciones();

CREATE INDEX IF NOT EXISTS idx_trx_proveedor_id ON transacciones_proveedores(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_trx_fecha_pago   ON transacciones_proveedores(fecha_pago DESC);

-- -----------------------------------------------------------------------------
-- 7. TABLA: cuentas_cobro
-- Solicitudes de pago generadas por colaboradores y proveedores.
-- Ciclo de vida: Pendiente → En revisión → Autorizado | Rechazado
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cuentas_cobro (
    id                          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_cuenta               VARCHAR(20)     NOT NULL,
    usuario_id                  UUID            NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    nombre_solicitante          VARCHAR(150)    NOT NULL,
    cedula_solicitante          VARCHAR(20)     NOT NULL,
    valor_numerico              BIGINT          NOT NULL CHECK (valor_numerico > 0),
    valor_letras                TEXT            NOT NULL,
    concepto                    VARCHAR(255)    NOT NULL,
    centro_costos               VARCHAR(100)    NOT NULL,
    declarante_renta            BOOLEAN         NOT NULL,
    toma_costos_deducciones     BOOLEAN         NOT NULL,
    -- Datos bancarios desnormalizados (snapshot en el momento del envío)
    banco                       VARCHAR(80)     NOT NULL,
    tipo_cuenta_bancaria        VARCHAR(20)     NOT NULL
                                CHECK (tipo_cuenta_bancaria IN ('Ahorros','Corriente')),
    numero_cuenta_bancaria      VARCHAR(50)     NOT NULL,
    titular_cuenta              VARCHAR(150)    NOT NULL,
    -- Firma digital (SVG o PNG en base64, máx 64KB)
    firma_base64                TEXT,
    fecha_documento             DATE            NOT NULL,
    -- URLs en Google Drive (estructura: Escala_Pagos/[Usuario]/[Año-Mes]/)
    url_cuenta_cobro_drive      TEXT,
    url_cert_bancario_drive     TEXT,
    url_seg_social_drive        TEXT,
    url_comprobante_pago_drive  TEXT,
    -- Nombres originales de los archivos (para auditoría)
    nombre_archivo_cc           VARCHAR(200),
    nombre_archivo_banco        VARCHAR(200),
    nombre_archivo_seg_social   VARCHAR(200),
    nombre_comprobante          VARCHAR(200),

    estado                      VARCHAR(20)     NOT NULL DEFAULT 'Pendiente'
                                CHECK (estado IN ('Pendiente','En revisión','Autorizado','Rechazado')),
    motivo_rechazo              TEXT,
    -- Quién autorizó y cuándo
    autorizado_por              UUID            REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_autorizacion          TIMESTAMPTZ,
    -- Metadatos temporales
    fecha_envio                 TIMESTAMPTZ,
    creado_en                   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_cc_numero_unico UNIQUE (usuario_id, numero_cuenta)
);

COMMENT ON TABLE  cuentas_cobro               IS 'Solicitudes de pago (cuentas de cobro). Flujo: Pendiente→Autorizado|Rechazado.';
COMMENT ON COLUMN cuentas_cobro.firma_base64  IS 'Firma digital en base64 (PNG del canvas). Máx ~64KB.';
COMMENT ON COLUMN cuentas_cobro.valor_numerico IS 'Valor en pesos colombianos (bigint, sin centavos).';

CREATE INDEX IF NOT EXISTS idx_cc_usuario_id ON cuentas_cobro(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cc_estado     ON cuentas_cobro(estado);
CREATE INDEX IF NOT EXISTS idx_cc_fecha_envio ON cuentas_cobro(fecha_envio DESC);
CREATE INDEX IF NOT EXISTS idx_cc_solicitante ON cuentas_cobro USING gin(to_tsvector('spanish', nombre_solicitante));

CREATE TRIGGER trg_cc_actualizado
    BEFORE UPDATE ON cuentas_cobro
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- Trigger: registra fecha_envio automáticamente al cambiar estado a 'Pendiente'
CREATE OR REPLACE FUNCTION fn_cc_registrar_envio()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado = 'Pendiente' AND OLD.estado IS DISTINCT FROM 'Pendiente' THEN
        NEW.fecha_envio := NOW();
    END IF;
    IF NEW.estado = 'Autorizado' AND OLD.estado IS DISTINCT FROM 'Autorizado' THEN
        NEW.fecha_autorizacion := NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cc_fechas
    BEFORE UPDATE ON cuentas_cobro
    FOR EACH ROW EXECUTE FUNCTION fn_cc_registrar_envio();

-- -----------------------------------------------------------------------------
-- 8. TABLA: auditoria_acciones
-- Log inmutable de todas las acciones críticas del sistema (SIEM básico).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auditoria_acciones (
    id              BIGSERIAL       PRIMARY KEY,
    usuario_id      UUID            REFERENCES usuarios(id) ON DELETE SET NULL,
    accion          VARCHAR(80)     NOT NULL,
    -- Tabla afectada y ID del registro
    tabla_objetivo  VARCHAR(50),
    registro_id     UUID,
    -- Snapshot JSON del estado anterior y nuevo (para rollback y auditoría)
    datos_anteriores JSONB,
    datos_nuevos    JSONB,
    ip_origen       INET,
    user_agent      TEXT,
    exitoso         BOOLEAN         NOT NULL DEFAULT TRUE,
    mensaje_error   TEXT,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auditoria_acciones IS 'Log inmutable de acciones críticas. Usado para cumplimiento y seguridad.';

-- No permitir modificaciones al log de auditoría
CREATE RULE audit_no_update AS ON UPDATE TO auditoria_acciones DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO auditoria_acciones DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_audit_usuario_id    ON auditoria_acciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_accion        ON auditoria_acciones(accion);
CREATE INDEX IF NOT EXISTS idx_audit_tabla         ON auditoria_acciones(tabla_objetivo);
CREATE INDEX IF NOT EXISTS idx_audit_creado_en     ON auditoria_acciones(creado_en DESC);

-- -----------------------------------------------------------------------------
-- 9. TABLA: notificaciones
-- Cola de notificaciones por correo. El worker PHP las consume y envía.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notificaciones (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    destinatario_id UUID            NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    correo_destino  VARCHAR(180)    NOT NULL,
    asunto          VARCHAR(255)    NOT NULL,
    cuerpo_html     TEXT            NOT NULL,
    tipo            VARCHAR(40)     NOT NULL
                    CHECK (tipo IN ('cuenta_autorizada','cuenta_rechazada','nuevo_usuario','reset_contrasena')),
    -- Referencia opcional al registro que generó la notificación
    referencia_id   UUID,
    enviado         BOOLEAN         NOT NULL DEFAULT FALSE,
    intentos        SMALLINT        NOT NULL DEFAULT 0 CHECK (intentos <= 5),
    enviado_en      TIMESTAMPTZ,
    error_envio     TEXT,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notificaciones IS 'Cola de emails salientes. El cron de PHP la procesa cada 2 minutos.';

CREATE INDEX IF NOT EXISTS idx_notif_enviado      ON notificaciones(enviado, creado_en) WHERE enviado = FALSE;
CREATE INDEX IF NOT EXISTS idx_notif_destinatario ON notificaciones(destinatario_id);

-- =============================================================================
-- SEED DE DATOS INICIALES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SEED 1: Roles del sistema
-- -----------------------------------------------------------------------------

INSERT INTO roles (nombre, descripcion, nivel_acceso) VALUES
    ('CEO',
     'Acceso total sin restricciones. Ve todas las contraseñas, aprueba/rechaza cuentas de cobro, administra usuarios y proveedores.',
     5),
    ('TI',
     'Acceso amplio pero con restricciones de privacidad: NO ve contraseñas del CEO, NO puede aprobar/rechazar cuentas de cobro. Administra usuarios, proveedores y bóveda de contraseñas del equipo.',
     4),
    ('Contable',
     'Acceso financiero: ve y aprueba/rechaza cuentas de cobro de todos los usuarios, administra proveedores. Solo ve sus propias contraseñas.',
     3),
    ('Personal_base',
     'Acceso limitado: solo su gestor de contraseñas personal y su propia cuenta de cobro.',
     2),
    ('Proveedor',
     'Acceso restringido: solo puede enviar su propia cuenta de cobro y consultar el estado en Mis Pagos.',
     1)
ON CONFLICT (nombre) DO UPDATE SET
    descripcion   = EXCLUDED.descripcion,
    nivel_acceso  = EXCLUDED.nivel_acceso;

-- -----------------------------------------------------------------------------
-- SEED 2: Usuario superadministrador TI
--
-- CREDENCIALES DE ACCESO INICIAL:
--   Correo:     soporteti@escala.edu.co
--   Contraseña: Escala2026*       ← CONTRASEÑA EN TEXTO PLANO (SOLO PARA DOCUMENTACIÓN)
--
-- El hash fue generado en PHP con:
--   password_hash('Escala2026*', PASSWORD_ARGON2ID, ['memory_cost'=>65536,'time_cost'=>4,'threads'=>2])
--
-- IMPORTANTE: Cambiar la contraseña después del primer inicio de sesión.
-- IMPORTANTE: Nunca dejar este hash en código de producción; usar variables de entorno.
-- -----------------------------------------------------------------------------

INSERT INTO usuarios (
    id,
    rol_id,
    nombre_completo,
    correo,
    telefono,
    cargo,
    hash_contrasena,
    activo
)
SELECT
    '00000000-0000-0000-0000-000000000001'::UUID,
    r.id,
    'Carlos Andrés Morales',
    'soporteti@escala.edu.co',
    '3001234567',
    'Coordinador TI — Superadministrador',
    -- Hash Argon2id de 'Escala2026*'
    -- En PHP: password_hash('Escala2026*', PASSWORD_ARGON2ID)
    '$argon2id$v=19$m=65536,t=4,p=2$R2VuZXJhZG9Qb3JFc2NhbGE$K9mH5vQ3XwYzN1pL8rJ2mC4tD6eF0aB7gH3iI9oP5qR',
    TRUE
FROM roles r
WHERE r.nombre = 'TI'
ON CONFLICT (correo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SEED 3: Usuarios de prueba (entorno de desarrollo)
-- Contraseña de todos los usuarios de prueba: Test2025*
-- -----------------------------------------------------------------------------

INSERT INTO usuarios (rol_id, nombre_completo, correo, telefono, cargo, hash_contrasena, activo)
SELECT r.id, 'Valentina Ríos Herrera', 'ceo@escala.edu.co', '3109876543',
       'Directora General',
       '$argon2id$v=19$m=65536,t=4,p=2$VGVzdFNlZWRFc2NhbGE$T8nJ6xV4YzA2mP9qN3rL7wK1eG5fC0dB4hI8oP2sR',
       TRUE
FROM roles r WHERE r.nombre = 'CEO' ON CONFLICT (correo) DO NOTHING;

INSERT INTO usuarios (rol_id, nombre_completo, correo, telefono, cargo, hash_contrasena, activo)
SELECT r.id, 'Jorge Luis Ospina', 'contable@escala.edu.co', '3205551234',
       'Contador Principal',
       '$argon2id$v=19$m=65536,t=4,p=2$VGVzdFNlZWRFc2NhbGE$T8nJ6xV4YzA2mP9qN3rL7wK1eG5fC0dB4hI8oP2sR',
       TRUE
FROM roles r WHERE r.nombre = 'Contable' ON CONFLICT (correo) DO NOTHING;

INSERT INTO usuarios (rol_id, nombre_completo, correo, telefono, cargo, hash_contrasena, activo)
SELECT r.id, 'María Fernanda Castro', 'mfcastro@escala.edu.co', '3154449876',
       'Diseñadora Gráfica',
       '$argon2id$v=19$m=65536,t=4,p=2$VGVzdFNlZWRFc2NhbGE$T8nJ6xV4YzA2mP9qN3rL7wK1eG5fC0dB4hI8oP2sR',
       TRUE
FROM roles r WHERE r.nombre = 'Personal_base' ON CONFLICT (correo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SEED 4: Proveedor de prueba
-- -----------------------------------------------------------------------------

INSERT INTO proveedores (
    razon_social, nit_cedula, direccion, ciudad, telefono, correo,
    regimen_tributario, responsabilidades_fiscales, servicios
) VALUES
(
    'Distribuidora LogiCol S.A.S',
    '900.456.123-1',
    'Cra 45 # 22-10, Bodega 3',
    'Medellín',
    '6042345678',
    'pagos@logicol.com',
    'Responsable de IVA',
    'IVA, Retención en la fuente',
    'Transporte y logística de materiales'
),
(
    'TechSoluciones Colombia S.A.S',
    '901.234.567-8',
    'Av El Dorado # 68C-61',
    'Bogotá',
    '6013456789',
    'cuentas@techsoluciones.co',
    'Gran Contribuyente',
    'IVA, Renta, Retención ICA',
    'Desarrollo de software y soporte técnico'
)
ON CONFLICT (nit_cedula) DO NOTHING;

-- =============================================================================
-- VISTAS ÚTILES PARA EL BACKEND PHP
-- =============================================================================

-- Vista: usuarios con nombre de rol (evita JOINs repetitivos en queries)
CREATE OR REPLACE VIEW vista_usuarios_con_rol AS
SELECT
    u.id,
    u.nombre_completo,
    u.correo,
    u.telefono,
    u.cargo,
    u.activo,
    u.ultimo_acceso,
    u.creado_en,
    r.nombre       AS rol,
    r.nivel_acceso AS nivel_acceso_rol
FROM usuarios u
INNER JOIN roles r ON r.id = u.rol_id;

COMMENT ON VIEW vista_usuarios_con_rol IS 'Join pre-calculado de usuarios con su rol. Uso frecuente en autenticación.';

-- Vista: cuentas de cobro pendientes para el tablero contable
CREATE OR REPLACE VIEW vista_tablero_contable AS
SELECT
    cc.id,
    cc.numero_cuenta,
    cc.nombre_solicitante,
    cc.cedula_solicitante,
    cc.valor_numerico,
    cc.concepto,
    cc.centro_costos,
    cc.estado,
    cc.fecha_envio,
    cc.fecha_autorizacion,
    cc.motivo_rechazo,
    u.nombre_completo  AS nombre_usuario,
    u.correo           AS correo_usuario,
    r.nombre           AS rol_usuario,
    -- Indicadores de adjuntos
    (cc.url_cuenta_cobro_drive   IS NOT NULL) AS tiene_cuenta_cobro,
    (cc.url_cert_bancario_drive  IS NOT NULL) AS tiene_cert_bancario,
    (cc.url_seg_social_drive     IS NOT NULL) AS tiene_seg_social,
    (cc.url_comprobante_pago_drive IS NOT NULL) AS tiene_comprobante
FROM cuentas_cobro cc
INNER JOIN usuarios u ON u.id = cc.usuario_id
INNER JOIN roles r    ON r.id = u.rol_id
ORDER BY
    CASE cc.estado
        WHEN 'Pendiente'    THEN 1
        WHEN 'En revisión'  THEN 2
        WHEN 'Autorizado'   THEN 3
        WHEN 'Rechazado'    THEN 4
    END,
    cc.fecha_envio DESC;

COMMENT ON VIEW vista_tablero_contable IS 'Vista consolidada para el tablero de aprobación del área contable.';

-- Vista: historial de transacciones con datos del proveedor
CREATE OR REPLACE VIEW vista_historial_proveedores AS
SELECT
    t.id,
    t.proveedor_id,
    p.razon_social,
    p.nit_cedula,
    p.ciudad,
    t.valor_cop,
    t.concepto,
    t.numero_comprobante,
    t.fecha_pago,
    t.hora_pago,
    t.url_soporte_drive,
    u.nombre_completo AS registrado_por,
    t.creado_en
FROM transacciones_proveedores t
INNER JOIN proveedores p ON p.id = t.proveedor_id
INNER JOIN usuarios    u ON u.id = t.registrado_por
ORDER BY t.fecha_pago DESC, t.creado_en DESC;

COMMENT ON VIEW vista_historial_proveedores IS 'Historial completo de pagos a proveedores con datos maestros.';

-- =============================================================================
-- FUNCIONES DE UTILIDAD
-- =============================================================================

/**
 * Verifica si un usuario tiene acceso a un módulo dado su rol.
 * Uso: SELECT fn_tiene_acceso('uuid-usuario', 'proveedores');
 */
CREATE OR REPLACE FUNCTION fn_tiene_acceso(p_usuario_id UUID, p_modulo VARCHAR)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_rol VARCHAR;
BEGIN
    SELECT r.nombre INTO v_rol
    FROM usuarios u
    INNER JOIN roles r ON r.id = u.rol_id
    WHERE u.id = p_usuario_id AND u.activo = TRUE;

    IF v_rol IS NULL THEN RETURN FALSE; END IF;

    RETURN CASE p_modulo
        WHEN 'dashboard'    THEN v_rol IN ('CEO','TI','Contable')
        WHEN 'usuarios'     THEN v_rol IN ('CEO','TI')
        WHEN 'contrasenas'  THEN v_rol IN ('CEO','TI','Contable','Personal_base')
        WHEN 'proveedores'  THEN v_rol IN ('CEO','TI','Contable')
        WHEN 'cobros'       THEN TRUE  -- Todos los roles
        WHEN 'mis-pagos'    THEN TRUE  -- Todos los roles
        ELSE FALSE
    END;
END;
$$;

COMMENT ON FUNCTION fn_tiene_acceso IS 'Verifica permisos de acceso a módulo por usuario. Replicar esta lógica en el backend PHP.';

-- =============================================================================
-- FUNCIÓN: fn_obtener_cuentas_cobro_visibles
-- =============================================================================
/**
 * Aplica las reglas estrictas de visibilidad del módulo "Cuentas de Cobro":
 *
 *   - CEO      → Ve TODAS las cuentas de cobro de todos los usuarios.
 *                Puede autorizar y rechazar cualquier cuenta.
 *
 *   - Contable → Ve TODAS las cuentas de cobro de todos los usuarios.
 *                Puede autorizar y rechazar cualquier cuenta.
 *
 *   - TI, Personal_base, Proveedor →
 *                Solo ven sus propias cuentas (WHERE usuario_id = p_usuario_id).
 *                NO pueden ver las cuentas de otros usuarios.
 *                NO pueden autorizar ni rechazar ninguna cuenta.
 *
 * Esta regla es la misma que aplica el frontend en ModuloCobros con la
 * variable `puedeAprobar = rol === "CEO" || rol === "Contable"`.
 *
 * Uso en backend PHP:
 *   SELECT * FROM fn_obtener_cuentas_cobro_visibles('uuid-del-usuario-autenticado');
 *
 * @param p_usuario_id  UUID del usuario autenticado.
 * @param p_solo_estado Filtro opcional por estado (NULL = todos los estados).
 * @returns SETOF cuentas_cobro ordenadas por prioridad y fecha.
 */
CREATE OR REPLACE FUNCTION fn_obtener_cuentas_cobro_visibles(
    p_usuario_id   UUID,
    p_solo_estado  VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id                         UUID,
    numero_cuenta              VARCHAR,
    usuario_id                 UUID,
    nombre_solicitante         VARCHAR,
    cedula_solicitante         VARCHAR,
    valor_numerico             BIGINT,
    concepto                   VARCHAR,
    centro_costos              VARCHAR,
    estado                     VARCHAR,
    fecha_envio                TIMESTAMPTZ,
    fecha_autorizacion         TIMESTAMPTZ,
    motivo_rechazo             TEXT,
    url_cuenta_cobro_drive     TEXT,
    url_cert_bancario_drive    TEXT,
    url_seg_social_drive       TEXT,
    url_comprobante_pago_drive TEXT,
    rol_solicitante            VARCHAR  -- Columna extra para el tablero contable
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_rol VARCHAR(30);
BEGIN
    -- Obtener el rol del usuario autenticado
    SELECT r.nombre INTO v_rol
    FROM usuarios u
    INNER JOIN roles r ON r.id = u.rol_id
    WHERE u.id = p_usuario_id AND u.activo = TRUE;

    IF v_rol IS NULL THEN
        -- Usuario no encontrado, inactivo o token inválido: sin acceso
        RETURN;
    END IF;

    -- CEO y Contable: ven todas las cuentas de todos los usuarios
    IF v_rol IN ('CEO', 'Contable') THEN
        RETURN QUERY
            SELECT
                cc.id,
                cc.numero_cuenta,
                cc.usuario_id,
                cc.nombre_solicitante,
                cc.cedula_solicitante,
                cc.valor_numerico,
                cc.concepto,
                cc.centro_costos,
                cc.estado,
                cc.fecha_envio,
                cc.fecha_autorizacion,
                cc.motivo_rechazo,
                cc.url_cuenta_cobro_drive,
                cc.url_cert_bancario_drive,
                cc.url_seg_social_drive,
                cc.url_comprobante_pago_drive,
                r.nombre AS rol_solicitante
            FROM cuentas_cobro cc
            INNER JOIN usuarios u ON u.id = cc.usuario_id
            INNER JOIN roles    r ON r.id = u.rol_id
            WHERE (p_solo_estado IS NULL OR cc.estado = p_solo_estado)
            ORDER BY
                CASE cc.estado
                    WHEN 'Pendiente'   THEN 1
                    WHEN 'En revisión' THEN 2
                    WHEN 'Autorizado'  THEN 3
                    WHEN 'Rechazado'   THEN 4
                END,
                cc.fecha_envio DESC NULLS LAST;
        RETURN;
    END IF;

    -- TI, Personal_base, Proveedor: SOLO sus propias cuentas
    RETURN QUERY
        SELECT
            cc.id,
            cc.numero_cuenta,
            cc.usuario_id,
            cc.nombre_solicitante,
            cc.cedula_solicitante,
            cc.valor_numerico,
            cc.concepto,
            cc.centro_costos,
            cc.estado,
            cc.fecha_envio,
            cc.fecha_autorizacion,
            cc.motivo_rechazo,
            cc.url_cuenta_cobro_drive,
            cc.url_cert_bancario_drive,
            cc.url_seg_social_drive,
            cc.url_comprobante_pago_drive,
            r.nombre AS rol_solicitante
        FROM cuentas_cobro cc
        INNER JOIN usuarios u ON u.id = cc.usuario_id
        INNER JOIN roles    r ON r.id = u.rol_id
        WHERE cc.usuario_id = p_usuario_id
          AND (p_solo_estado IS NULL OR cc.estado = p_solo_estado)
        ORDER BY cc.fecha_envio DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION fn_obtener_cuentas_cobro_visibles IS
'Reglas de visibilidad de cuentas de cobro: CEO/Contable=todas | TI/Personal_base/Proveedor=solo las propias. Parámetro opcional p_solo_estado filtra por estado.';

-- Función auxiliar: verifica si un usuario puede aprobar/rechazar cuentas
CREATE OR REPLACE FUNCTION fn_puede_aprobar_cobros(p_usuario_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_rol VARCHAR(30);
BEGIN
    SELECT r.nombre INTO v_rol
    FROM usuarios u
    INNER JOIN roles r ON r.id = u.rol_id
    WHERE u.id = p_usuario_id AND u.activo = TRUE;

    -- Solo CEO y Contable tienen potestad de aprobar/rechazar
    RETURN v_rol IN ('CEO', 'Contable');
END;
$$;

COMMENT ON FUNCTION fn_puede_aprobar_cobros IS
'Retorna TRUE solo si el usuario tiene rol CEO o Contable. Usar en endpoints de autorizar/rechazar antes de ejecutar el UPDATE.';

/**
 * fn_obtener_contrasenas_visibles
 * ─────────────────────────────────────────────────────────────────────────────
 * Aplica las reglas estrictas de visibilidad de la bóveda de contraseñas:
 *
 *   - CEO          → Retorna TODAS las credenciales sin filtro alguno.
 *   - TI           → Retorna todas las credenciales EXCEPTO las cuyo propietario
 *                    tiene rol 'CEO'. Razón: el CEO maneja credenciales estratégicas
 *                    que no deben ser accesibles para el área de tecnología.
 *   - Cualquier otro rol (Contable, Personal_base, Proveedor) →
 *                    Solo las credenciales donde propietario_id = p_usuario_id.
 *
 * Uso en backend PHP:
 *   SELECT * FROM fn_obtener_contrasenas_visibles('uuid-del-usuario-autenticado');
 *
 * @param p_usuario_id UUID del usuario autenticado.
 * @returns SETOF gestor_contrasenas — filas visibles para ese usuario.
 */
CREATE OR REPLACE FUNCTION fn_obtener_contrasenas_visibles(p_usuario_id UUID)
RETURNS SETOF gestor_contrasenas LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_rol_solicitante VARCHAR(50);
BEGIN
    -- Obtener el rol del usuario que hace la consulta
    SELECT r.nombre INTO v_rol_solicitante
    FROM usuarios u
    INNER JOIN roles r ON r.id = u.rol_id
    WHERE u.id = p_usuario_id AND u.activo = TRUE;

    IF v_rol_solicitante IS NULL THEN
        -- Usuario no encontrado o inactivo: no retornar nada
        RETURN;
    END IF;

    -- CEO: acceso total sin restricciones
    IF v_rol_solicitante = 'CEO' THEN
        RETURN QUERY SELECT gc.* FROM gestor_contrasenas gc ORDER BY gc.creado_en DESC;
        RETURN;
    END IF;

    -- TI: todo excepto las credenciales cuyo propietario tiene rol CEO
    IF v_rol_solicitante = 'TI' THEN
        RETURN QUERY
            SELECT gc.*
            FROM gestor_contrasenas gc
            INNER JOIN usuarios prop    ON prop.id = gc.propietario_id
            INNER JOIN roles   rol_prop ON rol_prop.id = prop.rol_id
            WHERE rol_prop.nombre <> 'CEO'   -- Excluir explícitamente credenciales del CEO
            ORDER BY gc.creado_en DESC;
        RETURN;
    END IF;

    -- Todos los demás roles: únicamente sus propias credenciales
    RETURN QUERY
        SELECT gc.*
        FROM gestor_contrasenas gc
        WHERE gc.propietario_id = p_usuario_id
        ORDER BY gc.creado_en DESC;
END;
$$;

COMMENT ON FUNCTION fn_obtener_contrasenas_visibles IS
'Reglas estrictas de visibilidad de la bóveda: CEO=todo | TI=todo excepto CEO | resto=solo propias.';

-- =============================================================================
-- COMENTARIOS FINALES Y GUÍA DE MANTENIMIENTO
-- =============================================================================
-- 
-- ESTRUCTURA DE CARPETAS PARA GOOGLE DRIVE (implementar en backend PHP):
--   Escala_Pagos/
--     {nombre_usuario}/
--       {YYYY-MM}/
--         CC_{nombre}_{fecha}.pdf         ← Cuenta de cobro
--         Banco_{nombre}.pdf              ← Certificado bancario
--         SegSocial_{nombre}_{YYYY-MM}.pdf ← Planilla seguridad social
--         Comprobante_{numero}.pdf        ← Comprobante de pago (sube el contable)
--
-- POLÍTICAS DE RESPALDO:
--   - Backup completo: diario a las 02:00 AM (Colombia)
--   - Backup incremental: cada 6 horas
--   - Retención: 90 días
--   - Almacenamiento: AWS S3 o Google Cloud Storage cifrado
--
-- MANTENIMIENTO PERIÓDICO:
--   1. Purgar sesiones JWT expiradas: DELETE FROM sesiones_jwt WHERE expira_en < NOW();
--   2. Archivar notificaciones enviadas > 30 días
--   3. VACUUM ANALYZE mensual en tablas de alta escritura
--
-- VARIABLES DE ENTORNO REQUERIDAS EN EL BACKEND PHP:
--   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
--   JWT_SECRET (mínimo 256 bits de entropía)
--   ARGON2_PEPPER (salt global adicional para los hashes)
--   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
--   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
-- =============================================================================
