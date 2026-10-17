const fs = require('node:fs');
const path = require('node:path');

function transactionBody(sql) {
  // SQL files can also be pasted into a database editor with their own transaction.
  const opening = /^((?:\s|--[^\n]*(?:\n|$))*)BEGIN;\s*/i;
  const closing = /\bCOMMIT;\s*$/i;
  if (opening.test(sql) !== closing.test(sql)) throw new Error('Migration transaction wrapper is incomplete');
  return opening.test(sql) ? sql.replace(opening, '$1').replace(closing, '') : sql;
}

async function runMigrations(pool, directory = path.join(__dirname, '../db/migrations'), log = console.log) {
  const files = fs.readdirSync(directory).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  const migrations = files.map(name => ({ name, sql: transactionBody(fs.readFileSync(path.join(directory, name), 'utf8')) }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    // Serialize deploys against the same database before creating the ledger or schema.
    await client.query('SELECT pg_advisory_xact_lock(81731017)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const { rows } = await client.query('SELECT name FROM public.schema_migrations');
    const applied = new Set(rows.map(row => row.name));
    const pending = migrations.filter(migration => !applied.has(migration.name));
    for (const migration of pending) {
      await client.query(migration.sql);
      await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [migration.name]);
    }
    await client.query('COMMIT');
    for (const migration of pending) log(`Migrasi diterapkan: ${migration.name}`);
    if (!pending.length) log('Database sudah mengikuti seluruh migrasi.');
    return pending.map(migration => migration.name);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the original error */ }
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  (async () => {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL belum diatur. Isi environment atau file .env proyek sebelum menjalankan migrasi.');
      process.exitCode = 1;
      return;
    }
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await runMigrations(pool);
    } catch (error) {
      // Never print connection URLs, credentials, or database contents in build logs.
      console.error(`Migrasi database gagal (${error.code || error.name}). Periksa koneksi dan hak akses database, lalu jalankan ulang npm run db:migrate.`);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
}

module.exports = { runMigrations };
