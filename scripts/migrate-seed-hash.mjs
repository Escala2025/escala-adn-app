/**
 * Script de migración ONE-TIME: convierte el hash Argon2id (PHP) del usuario
 * seed inicial a bcrypt (Node.js / bcryptjs), compatible con la nueva
 * arquitectura Next.js.
 *
 * CUÁNDO EJECUTAR:
 *   Una sola vez, justo antes de arrancar la nueva versión de la aplicación.
 *
 * CÓMO EJECUTAR:
 *   node scripts/migrate-seed-hash.mjs
 *
 * REQUIERE:
 *   DATABASE_URL en el entorno o en .env
 *   npm install bcryptjs pg dotenv
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const require = createRequire(import.meta.url);

// Cargar .env si existe
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
      process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const { Pool } = require('pg');
const bcrypt    = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está definida en .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Usuarios cuyos hashes necesitan ser migrados a bcrypt.
 * Agrega aquí todos los usuarios que tengan hash Argon2id (PHP).
 * Formato: { correo, contrasenaPlana }
 *
 * SEGURIDAD: Elimina este archivo después de ejecutarlo en producción.
 */
const USUARIOS_MIGRAR = [
  { correo: 'soporteti@escala.edu.co', contrasenaPlana: 'Escala2026*' },
  // Agrega más usuarios aquí si necesitas migrar sus contraseñas:
  // { correo: 'ceo@escala.edu.co', contrasenaPlana: 'TuContrasenaReal' },
];

async function migrar() {
  const client = await pool.connect();
  let migrados = 0;

  console.log('─── Migración de hashes Argon2id → bcrypt ───');
  console.log(`Procesando ${USUARIOS_MIGRAR.length} usuario(s)...\n`);

  try {
    for (const { correo, contrasenaPlana } of USUARIOS_MIGRAR) {
      // Verificar que el usuario existe
      const { rows } = await client.query(
        'SELECT id, correo FROM usuarios WHERE LOWER(correo) = LOWER($1)',
        [correo],
      );

      if (rows.length === 0) {
        console.warn(`  OMITIDO: ${correo} — no encontrado en la BD`);
        continue;
      }

      const nuevoHash = await bcrypt.hash(contrasenaPlana, 12);

      await client.query(
        'UPDATE usuarios SET hash_contrasena = $1, actualizado_en = NOW() WHERE LOWER(correo) = LOWER($2)',
        [nuevoHash, correo],
      );

      console.log(`  OK: ${correo} — hash actualizado a bcrypt (cost=12)`);
      migrados++;
    }

    console.log(`\nMigración completada: ${migrados}/${USUARIOS_MIGRAR.length} usuario(s) actualizados.`);
    console.log('Ahora puedes iniciar la aplicación con: npm run dev\n');
  } catch (error) {
    console.error('\nERROR durante la migración:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrar();
