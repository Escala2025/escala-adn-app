/**
 * @fileoverview Capa de acceso a datos — Pool de conexiones PostgreSQL.
 * Utiliza el paquete `pg` con un singleton para evitar múltiples pools
 * en desarrollo con hot-reload de Next.js.
 *
 * Requerimientos en .env:
 *   DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/escala_adn
 */

// Agrega ", type QueryResultRow" al final de la lista de importación
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON DEL POOL
// El pool se reutiliza entre invocaciones de Server Actions gracias al
// módulo de caché de Node.js. En desarrollo, se guarda en `global` para
// sobrevivir el hot-reload de Next.js sin abrir demasiadas conexiones.
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function crearPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL no está definida. Agrega la variable en tu archivo .env:\n' +
      'DATABASE_URL="postgresql://postgres:Escala2026*@localhost:5432/escala_adn"',
    );
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                  // máximo de conexiones simultáneas
    idleTimeoutMillis: 30000, // cierra conexiones inactivas después de 30s
    connectionTimeoutMillis: 5000, // error si no conecta en 5s
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });
}

export const pool: Pool =
  process.env.NODE_ENV === 'development'
    ? (globalThis._pgPool ??= crearPool())
    : crearPool();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejecuta una query parametrizada y devuelve las filas resultantes.
 * El cliente se libera automáticamente al finalizar.
 *
 * @example
 * const usuarios = await query<{ id: string; nombre: string }>(
 *   'SELECT id, nombre_completo AS nombre FROM usuarios WHERE activo = $1',
 *   [true]
 * );
 */
export async function query<T extends QueryResultRow = any>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  // Ahora pool.query<T> aceptará T sin errores porque cumple el contrato de 'pg'
  const resultado = await pool.query<T>(sql, params);
  return resultado.rows;
}

/**
 * Ejecuta una query dentro de una transacción.
 * Hace commit automático al finalizar o rollback si hay error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifica la conectividad con la base de datos.
 * Útil para health-checks y diagnóstico de arranque.
 */
export async function verificarConexion(): Promise<boolean> {
  try {
    await query('SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
}
