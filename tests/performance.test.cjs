const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ transpileOnly: true, compilerOptions: { rootDir: '.' } });
const db = require('../api/_db');
const auth = require('../api/_auth');
const { getDashboard } = require('../api/_dashboard');
const { handleDataRequest } = require('../api/_data-handler');
function browserModule(file, imports = {}) {
  const js = ts.transpileModule(fs.readFileSync('web/src/' + file, 'utf8').replace(/import\.meta\.env\.VITE_API_URL/g, JSON.stringify('https://east3.vercel.app')), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: name => imports[name], URLSearchParams, Date, Intl, console, ...imports.globals });
  return mod.exports;
}
const { createReadCache } = browserModule('readCache.ts');

test('reads coalesce until completion, expire from completion time, and retry failures', async () => {
  let now = 0, calls = 0, release;
  const cache = createReadCache(() => now);
  const fetcher = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const first = cache.read('plan', fetcher, 15);
  const second = cache.read('plan', fetcher, 15);
  assert.equal(first, second);
  await Promise.resolve();
  now = 50;
  assert.equal(cache.read('plan', fetcher, 15), first);
  release({ date: 'today' });
  await first;
  assert.equal(await cache.read('plan', fetcher, 15), await first);
  now = 66;
  const fresh = cache.read('plan', async () => { calls++; return 'fresh'; }, 15);
  assert.equal(await fresh, 'fresh');
  assert.equal(calls, 2);
  await assert.rejects(cache.read('bad', async () => { throw new Error('offline'); }));
  assert.equal(await cache.read('bad', async () => 'recovered'), 'recovered');
});

test('an old in-flight response cannot replace data fetched after invalidation', async () => {
  const cache = createReadCache();
  let release;
  const old = cache.read('plan', () => new Promise(resolve => { release = resolve; }));
  await Promise.resolve();
  cache.clear();
  assert.equal(await cache.read('plan', async () => 'new'), 'new');
  release('old');
  await old;
  assert.equal(await cache.read('plan', async () => 'unexpected'), 'new');
});

test('API reads share life requests and are invalidated by writes and account changes', async () => {
  const storage = new Map([['east3_token', 'user-A']]);
  let calls = 0;
  const mod = browserModule('api.ts', {
    './readCache': { createReadCache },
    '@capacitor/core': { Capacitor: { isNativePlatform: () => false } },
    globals: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) }, fetch: async () => {
      const call = ++calls;
      return { status: 200, ok: true, text: async () => JSON.stringify({ call }) };
    } },
  });
  const [a,b] = await Promise.all([mod.api.life('get'), mod.api.life('get')]);
  assert.equal(calls, 1); assert.equal(a.call, b.call);
  await mod.api.create('priorities', { title: 'test' });
  await mod.api.life('get');
  assert.equal(calls, 3);
  mod.setToken('user-B');
  await mod.api.life('get');
  assert.equal(calls, 4);
});

test('dashboard reads run in parallel with user ownership and local month boundaries', async () => {
  const original = db.query;
  const calls = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  db.query = async (sql, params) => { calls.push({ sql, params }); await gate; return []; };
  try {
    const pending = getDashboard('user-A', 'Asia/Jakarta', '2027-01-01');
    assert.equal(calls.length, 7);
    release();
    const resources = await pending;
    assert.equal(Object.keys(resources).length, 7);
    assert.ok(calls.every(call => call.params[0] === 'user-A'));
    const totals = calls.find(call => call.sql.includes('SUM(amount)'));
    assert.deepEqual(totals.params, ['user-A', '2026-12-31T17:00:00.000Z', '2027-01-31T17:00:00.000Z']);
    assert.match(totals.sql, /occurred_at >= .*occurred_at < .*GROUP BY type/);
    assert.ok(!calls.some(call => call.sql.includes('information_schema')));
  } finally { release(); db.query = original; }
});

test('a failed dashboard card leaves other cards usable', async () => {
  const original = db.query;
  db.query = async sql => {
    if (sql.includes('FROM transactions')) throw Object.assign(new Error('unavailable'), { code: '57014' });
    return [{ id: 'own-row' }];
  };
  try {
    const resources = await getDashboard('user-A', 'Asia/Jakarta', '2026-10-23');
    assert.ok(resources.tx.error);
    assert.equal(resources.events.data[0].id, 'own-row');
    assert.equal(resources.events.error, '');
  } finally { db.query = original; }
});

test('dashboard rejects unauthenticated requests and invalid dates before querying cards', async () => {
  const originalAuth = auth.requireUser, originalQuery = db.query;
  let reads = 0;
  db.query = async () => { reads++; return []; };
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    auth.requireUser = async () => ({ user: null, error: 'Unauthorized' });
    const denied = response();
    await handleDataRequest({ method: 'GET', headers: {}, query: { date: '2026-10-23' } }, denied, 'dashboard');
    assert.equal(denied.statusCode, 401);
    auth.requireUser = async () => ({ user: { id: 'user-A', timezone: 'Asia/Jakarta' }, error: null });
    const invalid = response();
    await handleDataRequest({ method: 'GET', headers: {}, query: { date: '2026-02-30' } }, invalid, 'dashboard');
    assert.equal(invalid.statusCode, 400);
    assert.equal(reads, 0);
  } finally { auth.requireUser = originalAuth; db.query = originalQuery; }
});
