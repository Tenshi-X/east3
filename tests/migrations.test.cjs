const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runMigrations } = require('../scripts/migrate.cjs');

function database({ applied = false, fail = false } = {}) {
  const queries = [];
  let released = false;
  const pool = { connect: async () => ({
    query: async (sql, values) => {
      queries.push({ sql, values });
      if (sql === 'SELECT name FROM public.schema_migrations') return { rows: applied ? [{ name: '20261017_wallets_habit_templates.sql' }] : [] };
      if (fail && sql.includes('CREATE TABLE IF NOT EXISTS wallets')) throw Object.assign(new Error('migration failed'), { code: '42501' });
      return { rows: [] };
    },
    release() { released = true; },
  }) };
  return { pool, queries, released: () => released };
}

test('pending migrations and ledger are committed together under a transaction lock', async () => {
  const db = database();
  const applied = await runMigrations(db.pool, undefined, () => {});
  assert.deepEqual(applied, ['20261017_wallets_habit_templates.sql']);
  assert.equal(db.queries[0].sql, 'BEGIN');
  assert.ok(db.queries.findIndex(q => q.sql.includes('pg_advisory_xact_lock')) < db.queries.findIndex(q => q.sql.includes('CREATE TABLE IF NOT EXISTS public.schema_migrations')));
  const migration = db.queries.find(q => q.sql.includes('CREATE TABLE IF NOT EXISTS wallets'));
  assert.ok(migration);
  assert.ok(!/^\s*(BEGIN|COMMIT);/im.test(migration.sql));
  assert.ok(migration.sql.includes('ALTER TABLE habits ADD COLUMN IF NOT EXISTS settings'));
  assert.equal(db.queries.at(-2).sql, 'INSERT INTO public.schema_migrations (name) VALUES ($1)');
  assert.equal(db.queries.at(-1).sql, 'COMMIT');
  assert.equal(db.released(), true);
});

test('repeated deploys skip migrations already recorded in the ledger', async () => {
  const db = database({ applied: true });
  assert.deepEqual(await runMigrations(db.pool, undefined, () => {}), []);
  assert.ok(db.queries.every(q => !q.sql.includes('CREATE TABLE IF NOT EXISTS wallets')));
  assert.equal(db.queries.at(-1).sql, 'COMMIT');
  assert.equal(db.released(), true);
});

test('migration errors roll back without recording success and release the connection', async () => {
  const db = database({ fail: true });
  const logs = [];
  await assert.rejects(runMigrations(db.pool, undefined, line => logs.push(line)), { code: '42501' });
  assert.equal(db.queries.at(-1).sql, 'ROLLBACK');
  assert.ok(db.queries.every(q => !q.sql.startsWith('INSERT INTO public.schema_migrations')));
  assert.equal(logs.length, 0);
  assert.equal(db.released(), true);
});
