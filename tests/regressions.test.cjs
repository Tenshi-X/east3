const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ transpileOnly: true, compilerOptions: { rootDir: '.' } });

const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
const columns = {};
for (const m of schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g)) {
  columns[m[1]] = [...m[2].matchAll(/^\s*(\w+)\s+(?:UUID|TEXT|DATE|TIME\b|TIMESTAMPTZ|NUMERIC|INTEGER|BOOLEAN|JSONB|vector)/gm)].map(x => x[1]);
}
const db = require('../api/_db');
const auth = require('../api/_auth');
const provider = require('../api/ai-proxy');
const { handleDataRequest } = require('../api/_data-handler');
const { handleAIRequest } = require('../api/_ai-handler');
let queries, parentOwned, rows, aiHistory;
beforeEach(() => {
  queries = []; parentOwned = true; rows = [{ id: 'own-row' }]; aiHistory = [];
  auth.requireUser = async () => ({ user: { id: 'user-A' }, error: null });
  db.query = async (sql, params = []) => {
    if (sql.includes('information_schema.columns')) return columns[params[0]].map(column_name => ({ column_name }));
    queries.push({ sql, params });
    if (sql.includes('SELECT role, content')) return aiHistory;
    return rows;
  };
  db.queryOne = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('SELECT timezone')) return { timezone: 'Asia/Jakarta' };
    return parentOwned ? { id: 'own-parent' } : null;
  };
  provider.callOpenRouter = async () => ({ candidates: [{ content: { parts: [{ text: 'Hello' }] } }], modelUsed: 'free-test' });
});
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
async function data(method, table, body, id, query = {}) {
  const res = response();
  await handleDataRequest({ method, headers: {}, body, query }, res, table, id);
  return res;
}

test('all child-table reads, updates, and deletes include authenticated parent ownership', async () => {
  for (const [table, parent, column] of [['habit_logs', 'habits', 'habit_id'], ['workout_sets', 'workout_logs', 'workout_log_id'], ['ai_messages', 'ai_conversations', 'conversation_id']]) {
    for (const [method, body, id] of [['GET'], ['GET', undefined, 'other-row'], ['PATCH', { notes: 'x' }, 'other-row'], ['DELETE', undefined, 'other-row']]) {
      // ai_messages uses content rather than notes.
      const payload = method === 'PATCH' && table === 'ai_messages' ? { content: 'x' } : body;
      queries.length = 0;
      await data(method, table, payload, id);
      const executed = queries.at(-1);
      assert.match(executed.sql, new RegExp(`FROM ${parent} owner WHERE owner.id = ${table}\\.${column} AND owner.user_id = \\$\\d+`));
      assert.ok(executed.params.includes('user-A'));
    }
  }
});

test('foreign or missing parents cannot be inserted, reassigned, or upserted', async () => {
  parentOwned = false;
  for (const [table, column] of [['habit_logs', 'habit_id'], ['workout_sets', 'workout_log_id'], ['ai_messages', 'conversation_id'], ['workout_logs', 'plan_id']]) {
    for (const method of ['POST', 'PATCH']) {
      const res = await data(method, table, { [column]: 'someone-elses-parent' }, method === 'PATCH' ? 'own-row' : undefined);
      assert.equal(res.statusCode, 404);
    }
  }
  const res = await data('POST', 'habit_logs', { row: { habit_id: 'foreign', date: '2026-10-17', is_completed: true }, on_conflict: 'habit_id,date' }, 'upsert');
  assert.equal(res.statusCode, 404);
  assert.ok(queries.every(x => !/^(INSERT|UPDATE)/.test(x.sql)));
});

test('owner reassignment, unknown fields, and unsafe conflict columns are rejected', async () => {
  for (const payload of [{ user_id: 'user-B' }, { 'title = NULL; --': 'x' }, { log_date: '2026-10-17' }]) {
    const res = await data('POST', 'habit_logs', payload);
    assert.equal(res.statusCode, 400);
  }
  for (const conflict of ['id', 'habit_id,date); DELETE FROM users; --']) {
    const res = await data('POST', 'habit_logs', { row: { habit_id: 'own', date: '2026-10-17', is_completed: true }, on_conflict: conflict }, 'upsert');
    assert.equal(res.statusCode, 400);
  }
});

test('habit upserts and budget upserts retain ownership on conflict', async () => {
  for (const [table, row, conflict] of [
    ['habit_logs', { habit_id: 'own', date: '2026-10-17', value: 1, is_completed: true }, 'habit_id,date'],
    ['budgets', { category: 'food', month: '2026-10', monthly_limit: 100 }, 'user_id,category,month'],
  ]) {
    const res = await data('POST', table, { row, on_conflict: conflict }, 'upsert');
    assert.equal(res.statusCode, 201);
    assert.match(queries.at(-1).sql, /DO UPDATE SET .* WHERE .*user_id/);
    assert.equal(queries.at(-1).params.at(-1), 'user-A');
  }
});

test('workout day arrays are validated and set inserts require an owned log', async () => {
  assert.equal((await data('POST', 'workout_plans', { name: 'Push', day_of_week: 1 })).statusCode, 400);
  assert.equal((await data('POST', 'workout_plans', { name: 'Push', day_of_week: [7] })).statusCode, 400);
  assert.equal((await data('POST', 'workout_plans', { name: 'Push', day_of_week: [1, 0] })).statusCode, 201);
  assert.equal((await data('POST', 'workout_sets', { exercise_name: 'Bench', set_number: 1 })).statusCode, 400);
  assert.equal((await data('POST', 'workout_sets', { workout_log_id: 'own', exercise_name: 'Bench', set_number: 1, reps: 10, weight: 25 })).statusCode, 201);
});

test('pagination uses stable ordering and a lookahead row, with exclusive month end', async () => {
  rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i) }));
  const res = await data('GET', 'transactions', undefined, undefined, { limit: '500', offset: '500', filter_gte_occurred_at: '2026-09-30T17:00:00Z', filter_lt_occurred_at: '2026-10-31T17:00:00Z', order_by: 'occurred_at' });
  assert.equal(res.body.data.length, 500); assert.equal(res.body.has_more, true);
  assert.match(queries.at(-1).sql, /occurred_at < \$3 ORDER BY occurred_at DESC, id DESC LIMIT 501 OFFSET 500/);
  assert.equal((await data('GET', 'transactions', undefined, undefined, { offset: '-1' })).statusCode, 400);
});

test('wallets are scoped to the user and balances use all linked transactions', async () => {
  await data('GET', 'wallets');
  const sql = queries.at(-1).sql;
  assert.match(sql, /opening_balance \+ COALESCE/);
  assert.match(sql, /CASE WHEN type = 'income' THEN amount ELSE -amount END/);
  assert.match(sql, /wallet_id = wallets.id AND transactions.user_id = \$1/);
  assert.match(sql, /WHERE wallets.user_id = \$1/);
  assert.ok(!sql.includes('occurred_at'));
  assert.equal((await data('POST', 'wallets', { name: ' GoPay ', type: 'ewallet', opening_balance: 100000 })).statusCode, 201);
  assert.ok(queries.at(-1).params.includes('GoPay'));
  assert.ok(queries.at(-1).params.includes('user-A'));
  for (const payload of [{ name: ' ' }, { opening_balance: 'NaN' }, { type: 'foreign-type' }]) {
    assert.equal((await data('POST', 'wallets', payload)).statusCode, 400);
  }
});

test('transaction wallet assignment requires ownership on insert and update', async () => {
  parentOwned = false;
  for (const method of ['POST', 'PATCH']) {
    queries.length = 0;
    assert.equal((await data(method, 'transactions', { wallet_id: 'foreign' }, method === 'PATCH' ? 'tx' : undefined)).statusCode, 404);
    assert.ok(queries.every(q => !/^(INSERT|UPDATE)/.test(q.sql)));
  }
  assert.equal((await data('POST', 'transactions', { wallet_id: null, amount: 25, type: 'expense', category: 'food' })).statusCode, 201);
  parentOwned = true;
  assert.equal((await data('PATCH', 'transactions', { wallet_id: 'own' }, 'tx')).statusCode, 200);
  assert.match(queries.at(-1).sql, /transactions.user_id/);
});

test('missing wallet schemas return an actionable error and recover without caching empty columns', async () => {
  const original = db.query;
  let exists = false, inspections = 0, selects = 0;
  db.query = async (sql, params = []) => {
    if (sql.includes('information_schema.columns') && params[0] === 'wallets') {
      inspections++;
      return exists ? columns.wallets.map(column_name => ({ column_name })) : [];
    }
    if (sql.includes('FROM wallets WHERE')) {
      selects++;
      if (!exists) throw Object.assign(new Error('missing wallets'), { code: '42P01' });
    }
    return original(sql, params);
  };
  const unavailable = await data('GET', 'wallets');
  assert.equal(unavailable.statusCode, 503);
  assert.match(unavailable.body.error, /migrasi database/);
  const before = selects;
  assert.equal((await data('GET', 'wallets')).statusCode, 503);
  assert.equal(selects, before);
  exists = true;
  assert.equal((await data('GET', 'wallets')).statusCode, 200);
  assert.ok(inspections >= 2);
});

test('warm API instances refresh transaction columns added by a migration', async () => {
  const original = db.query;
  let missingColumn = true, upgraded = false, inspections = 0;
  db.query = async (sql, params = []) => {
    if (sql.includes('information_schema.columns') && params[0] === 'transactions') {
      inspections++;
      return columns.transactions.filter(column => upgraded || column !== 'wallet_id').map(column_name => ({ column_name }));
    }
    if (missingColumn && sql.startsWith('SELECT * FROM transactions')) throw Object.assign(new Error('schema not ready'), { code: '42703' });
    return original(sql, params);
  };
  assert.equal((await data('GET', 'transactions')).statusCode, 503);
  missingColumn = false;
  assert.equal((await data('GET', 'transactions')).statusCode, 200);
  upgraded = true;
  assert.equal((await data('POST', 'transactions', { amount: 25, type: 'expense', category: 'food', wallet_id: null })).statusCode, 201);
  assert.ok(inspections >= 2);
  assert.match(queries.at(-1).sql, /wallet_id/);
});

test('habit increments add atomically, clamp at zero and calculate completion against the target', async () => {
  const res = await data('POST', 'habit_logs', { habit_id: 'own', date: '2026-10-17', delta: 250 }, 'increment');
  assert.equal(res.statusCode, 200);
  const executed = queries.at(-1);
  assert.match(executed.sql, /FROM habits WHERE id = \$1 AND user_id = \$2/);
  assert.match(executed.sql, /ON CONFLICT \(habit_id, date\) DO UPDATE/);
  assert.match(executed.sql, /GREATEST\(0, COALESCE\(habit_logs.value, 0\) \+ \$4::numeric\)/);
  assert.match(executed.sql, /SELECT COALESCE\(target_value, 1\) FROM habits/);
  assert.equal(executed.params[1], 'user-A');
  assert.equal(executed.params[3], 250);
  assert.equal((await data('POST', 'habit_logs', { habit_id: 'own', date: '2026-10-17', delta: -250 }, 'increment')).statusCode, 200);
  rows = [];
  assert.equal((await data('POST', 'habit_logs', { habit_id: 'foreign', date: '2026-10-17', delta: 250 }, 'increment')).statusCode, 404);
  for (const delta of [0, '250', null, -Infinity, 0.001]) {
    assert.equal((await data('POST', 'habit_logs', { habit_id: 'own', date: '2026-10-17', delta }, 'increment')).statusCode, 400);
  }
});

test('habit targets and step sizes reject empty, zero and non-finite values', async () => {
  for (const field of ['target_value', 'step_value']) {
    for (const value of [0, -1, null, '', 'NaN', true, 0.001]) {
      assert.equal((await data('POST', 'habits', { name: 'Water', [field]: value })).statusCode, 400);
    }
  }
  assert.equal((await data('POST', 'habits', { name: 'Water', target_value: 2000, step_value: 250, settings: { template: 'water' } })).statusCode, 201);
});

test('AI forwards image-only requests, restores recent history in order, and persists both messages', async () => {
  aiHistory = [{ role: 'assistant', content: 'last reply' }, { role: 'user', content: 'previous question' }];
  let supplied;
  provider.callOpenRouter = async history => { supplied = history; return { candidates: [{ content: { parts: [{ text: 'Picture reply' }] } }] }; };
  const res = response();
  const image = 'data:image/png;base64,aGVsbG8=';
  await handleAIRequest({ headers: {}, body: { message: '', conversation_id: 'own', image } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(supplied[0].parts[0].text, 'previous question');
  assert.equal(supplied.at(-1).parts[1].inlineData, image);
  const saved = queries.find(x => x.sql.includes('INSERT INTO ai_messages'));
  assert.ok(saved); assert.equal(saved.params[2], 'Picture reply');
  assert.ok(!saved.params.includes(image));
  assert.match(saved.sql, /UPDATE ai_conversations/);
  assert.match(saved.sql, /INTERVAL '1 microsecond'/);
});

test('AI rejects foreign conversations and invalid attachments without calling the provider', async () => {
  let called = false;
  provider.callOpenRouter = async () => { called = true; };
  parentOwned = false;
  let res = response();
  await handleAIRequest({ headers: {}, body: { message: 'hello', conversation_id: 'foreign' } }, res);
  assert.equal(res.statusCode, 404);
  res = response();
  await handleAIRequest({ headers: {}, body: { message: 'hello', conversation_id: 'own', image: 'https://example.com/image.png' } }, res);
  assert.equal(res.statusCode, 400); assert.equal(called, false);
});

test('AI provider failure returns an error instead of saving a successful reply', async t => {
  t.mock.method(console, 'error', () => {});
  provider.callOpenRouter = async () => { throw new Error('test provider unavailable'); };
  const res = response();
  await handleAIRequest({ headers: {}, body: { message: 'hello', conversation_id: 'own' } }, res);
  assert.equal(res.statusCode, 502);
  assert.ok(!queries.some(x => x.sql.includes('INSERT INTO ai_messages')));
});

function browserModule(file, imports) {
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../web/src/', file), 'utf8').replace(/import\.meta\.env\.VITE_API_URL/g, JSON.stringify('https://east3.vercel.app')), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: name => imports[name], URLSearchParams, Date, Intl, console, ...imports.globals });
  return mod.exports;
}

test('water estimates stay within the starting range and glass/litre displays agree', () => {
  const habits = browserModule('habits.ts', {});
  assert.equal(habits.waterEstimate(70), 2100);
  assert.equal(habits.waterEstimate(20), 1500);
  assert.equal(habits.waterEstimate(300), 3000);
  const habit = { target_value: 2000, step_value: 250, unit: 'ml', settings: { template: 'water', glass_ml: 250, display_unit: 'glasses' } };
  assert.equal(habits.habitProgressText(habit, 500), '2 / 8 gelas · 0,5 liter');
  habit.settings.display_unit = 'liters';
  assert.equal(habits.habitProgressText(habit, 500), '0,5 / 2 liter · 2 gelas');
  assert.equal(habits.habitDone(habit, { value: 1750, is_completed: true }), false);
});

test('client pagination includes transactions beyond 1,000 rows and uses the Android API origin', async () => {
  let calls = 0;
  const mod = browserModule('api.ts', {
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true } },
    globals: { localStorage: { getItem: () => null }, fetch: async (url) => {
      assert.ok(url.startsWith('https://east3.vercel.app/api/data/transactions?'));
      const offset = Number(new URL(url).searchParams.get('offset'));
      calls++;
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: Array.from({ length: offset < 1000 ? 500 : 17 }, (_, i) => ({ id: offset + i, amount: 1 })), has_more: offset < 1000 }) };
    } },
  });
  const result = await mod.api.listAll('transactions', mod.monthRange('2026-10'));
  assert.equal(calls, 3); assert.equal(result.data.length, 1017);
  assert.equal(result.data.reduce((sum, row) => sum + row.amount, 0), 1017);
});

// Run the actual form callbacks without a DOM or a network connection.
function component(file, api) {
  let state = [], cursor = 0, effects = [], tree;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useCallback: callback => callback, useEffect: callback => { effects.push(callback); },
    useRef: () => ({ current: null }),
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const todayStr = date => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '2026-10-17';
    const ui = {
    usePageLoad: (_path, load) => effects.push(load),
    useCreatePanel: () => ({ open: true, close() {} }),
    useFeedback: () => ({ notify() {}, confirm: async () => true }),
    changed() {}, messageOf: error => error.message,
  };
  for (const name of ['Button','Field','Form','Icon','IconButton','LoadingState','Modal','Segments','Fab','EmptyState','ErrorState','Section']) ui[name] = function View() {};
  const mod = browserModule(file, { react, 'react-router-dom': { useNavigate: () => () => {} }, '../ui': ui, '../habits': browserModule('habits.ts', {}), '../HabitProgress': { default: function View() {} }, '../useLocalDay': { useLocalDay: todayStr }, 'react/jsx-runtime': { jsx, jsxs: jsx }, '../api': { api, todayStr, localDate: value => value.slice(0, 10) } });
  function render() { cursor = 0; effects = []; tree = mod.default({}); return tree; }
  function find(predicate, value) {
    if (arguments.length === 1) value = tree;
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const child of value) { const found = find(predicate, child); if (found) return found; } return; }
    if (predicate(value)) return value;
    return find(predicate, value.props?.children);
  }
  render();
  return { render, find, mount: async () => { for (const effect of effects) effect(); await new Promise(resolve => setImmediate(resolve)); render(); } };
}

test('Workout forms submit schema-compatible plan, log, and set payloads', async () => {
  const writes = [];
  const ui = component('pages/Workout.tsx', {
    list: async table => ({ data: table === 'workout_plans' ? [{ id: 'plan', name: 'Push', day_of_week: [1] }] : [] }),
    listAll: async () => ({ data: [] }),
    create: async (table, row) => { writes.push({ table, row }); return { data: { id: 'new-log' } }; },
  });
  await ui.mount();
  ui.find(x => x.props.placeholder === 'Contoh: Push Day A').props.onChange({ target: { value: 'Push' } }); ui.render();
  await ui.find(x => x.props.onSubmit?.name === 'addPlan').props.onSubmit();
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].row.day_of_week)), [1]);
  ui.render();
  ui.find(x => x.props.className === 'workout-link').props.onClick(); ui.render();
  ui.find(x => x.props.placeholder === 'Contoh: Bench Press').props.onChange({ target: { value: 'Bench' } }); ui.render();
  await ui.find(x => x.props.onSubmit?.name === 'saveWorkout').props.onSubmit();
  assert.equal(writes[1].row.date, '2026-10-17');
  assert.equal(writes[2].row.workout_log_id, 'new-log');
  assert.equal(writes[2].row.weight, 0); assert.equal(writes[2].row.reps, 10);
});

test('Habit form marks a completed day using date/value/is_completed', async () => {
  let write;
  const ui = component('pages/Habits.tsx', {
    listAll: async table => ({ data: table === 'habits' ? [{ id: 'habit', name: 'Water', target_value: 2 }] : [] }),
    upsert: async (table, row, conflict) => { write = { table, row, conflict }; },
  });
  await ui.mount();
  await ui.find(x => x.props.label === 'Check-in Water').props.onClick();
  assert.equal(write.row.date, '2026-10-17'); assert.equal(write.row.value, 2);
  assert.equal(write.row.is_completed, true); assert.equal(write.conflict, 'habit_id,date');
});

test('Habit check-in can be undone without leaving the day completed', async () => {
  let write;
  const ui = component('pages/Habits.tsx', {
    listAll: async table => ({ data: table === 'habits' ? [{ id: 'habit', name: 'Water', target_value: 2 }] : [{ habit_id: 'habit', date: '2026-10-17', is_completed: true, value: 2 }] }),
    upsert: async (table, row) => { write = row; },
  });
  await ui.mount();
  await ui.find(x => x.props.label === 'Batalkan check-in Water').props.onClick();
  assert.equal(write.is_completed, false); assert.equal(write.value, 0);
});

test('AI page restores persisted messages when reopened', async () => {
  let filters;
  const ui = component('pages/AICopilot.tsx', {
    list: async () => ({ data: [{ id: 'existing-conversation' }] }),
    listAll: async (table, params) => { filters = params; assert.equal(table, 'ai_messages'); return { data: [{ role: 'user', content: 'Saved question' }, { role: 'assistant', content: 'Saved answer' }] }; },
  });
  await ui.mount();
  assert.equal(filters.filter_eq_conversation_id, 'existing-conversation');
  assert.equal(filters.order_dir, 'asc');
  assert.ok(ui.find(x => x.props.className === 'bubble assistant' && JSON.stringify(x.props.children).includes('Saved answer')));
});
