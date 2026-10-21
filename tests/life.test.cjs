const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ transpileOnly: true, compilerOptions: { rootDir: '.' } });
const { localDay, zonedTime, shiftTimes, overlapsDay, buildDailyPlan, WORKOUT_TEMPLATES } = require('../shared/life');
const db = require('../api/_db');
const auth = require('../api/_auth');
const provider = require('../api/ai-proxy');
const { validateProfile, validateWellness, normalizeShiftRows, executeLifeTool, undoLifeAction } = require('../api/_life');
const { handleAIRequest } = require('../api/_ai-handler');
const tz = 'Asia/Jakarta';
const date = '2026-10-25';
const shift = (date, code) => ({ date, code, ...shiftTimes(date, code, tz) });
let queries;
beforeEach(() => {
  queries = [];
  auth.requireUser = async () => ({ user: { id: 'user-A' } });
  db.queryOne = async (sql, params) => { queries.push({ sql, params }); return sql.includes('SELECT timezone') ? { timezone: tz } : null; };
  db.query = async (sql, params) => { queries.push({ sql, params }); return []; };
  db.transaction = async work => work(async (sql, params) => { queries.push({ sql, params });
    if (sql.startsWith('INSERT INTO ai_action_logs')) return [{ id: 'audit-A' }];
    if (sql.startsWith('INSERT INTO')) return [{ id: 'new-A', user_id: 'user-A' }];
    return [];
  });
});

test('Jakarta date uses local midnight; night and combined shifts spill into next month', () => {
  assert.equal(localDay('2026-10-24T18:00:00Z', tz), date);
  assert.deepEqual(shiftTimes('2026-10-31', '3', tz), { start_time: '2026-10-31T15:00:00.000Z', end_time: '2026-10-31T23:00:00.000Z' });
  const night = shift('2026-10-31', '2&3');
  assert.ok(overlapsDay(night.start_time, night.end_time, '2026-11-01', tz));
  assert.ok(!overlapsDay(night.start_time, night.end_time, '2026-11-02', tz));
  assert.equal(zonedTime('2026-10-25', '06:00', tz), '2026-10-24T23:00:00.000Z');
  assert.throws(() => shiftTimes('2026-02-30', '1', tz));
});

test('IANA time conversion also works across daylight saving changes', () => {
  assert.equal(zonedTime('2026-07-01', '09:00', 'America/New_York'), '2026-07-01T13:00:00.000Z');
  assert.equal(zonedTime('2026-01-01', '09:00', 'America/New_York'), '2026-01-01T14:00:00.000Z');
  assert.throws(() => zonedTime('2026-03-08', '02:30', 'America/New_York'));
});

test('off day after the 16-hour shift protects recovery and does not schedule a workout', () => {
  const plan = buildDailyPlan({ date, timezone: tz, shifts: [shift('2026-10-24', '2&3'), shift(date, 'L')], tasks: [{ id: 'task', date, title: 'Laundry', duration_minutes: 15 }] });
  assert.equal(plan.recovery, true);
  assert.ok(!plan.items.some(i => i.kind === 'workout'));
  const sleep = plan.items.find(i => i.key.startsWith('sleep-recovery'));
  assert.equal(sleep.start_time, zonedTime(date, '07:00', tz));
  assert.equal(sleep.end_time, zonedTime(date, '15:00', tz));
  const task = plan.items.find(i => i.kind === 'task');
  assert.ok(Date.parse(task.start_time) >= Date.parse(sleep.end_time));
});

test('workout and tasks avoid work, commute, handover, sleep, and fixed events', () => {
  const day = '2026-10-26';
  const events = [{ start_time: zonedTime(day, '08:00', tz), end_time: zonedTime(day, '15:00', tz) }];
  const input = { date: day, timezone: tz, events, shifts: [shift(day, '2')], tasks: [{ id: 't', date: day, title: 'Bayar tagihan', duration_minutes: 15 }] };
  const plan = buildDailyPlan(input);
  for (const item of plan.items.filter(i => ['task', 'workout'].includes(i.kind))) {
    for (const block of plan.busy) assert.ok(Date.parse(item.end_time) <= Date.parse(block.start_time) || Date.parse(item.start_time) >= Date.parse(block.end_time));
  }
  assert.ok(!plan.items.some(i => i.kind === 'workout'));
});

test('low energy, short sleep, a long shift and recent workouts each defer training', () => {
  for (const extra of [{ logs: [{ date, kind: 'energy', energy: 2 }] }, { logs: [{ date, kind: 'sleep', sleep_hours: 5 }] }, { shifts: [shift(date, '1&2')] }, { workouts: [{ date: '2026-10-24' }] }]) {
    assert.ok(!buildDailyPlan({ date, timezone: tz, ...extra }).items.some(i => i.kind === 'workout'));
  }
  const plan = buildDailyPlan({ date, timezone: tz, programs: [{ schedule_mode: 'flexible', name: 'Program saya', exercises: WORKOUT_TEMPLATES[1].exercises }] });
  assert.equal(plan.items.find(i => i.kind === 'workout').title, 'Program saya');
  assert.ok(plan.items.find(i => i.kind === 'workout').exercises.length > 0);
  assert.ok(buildDailyPlan({ date, timezone: tz, workouts: [{ date: '2026-10-22' }, { date: '2026-10-22' }] }).items.some(i => i.kind === 'workout'));
});

test('shift import rejects impossible dates, duplicate dates, unknown codes and incomplete cells before any write', async () => {
  for (const rows of [[{ date: '2026-02-30', code: '1' }], [{ date, code: 'T' }], [{ date, code: null }], [{ date, code: '1' }, { date, code: '2' }]]) {
    assert.throws(() => normalizeShiftRows(rows, tz));
    await assert.rejects(executeLifeTool('save_shift_import', { rows }, 'user-A', tz));
  }
  assert.ok(queries.every(q => !q.sql.startsWith('INSERT')));
});

test('wellness input validates required values and never fabricates calories for an unknown meal', () => {
  assert.equal(validateWellness({ kind: 'meal', date, description: 'Nasi ayam' }, tz).calories, undefined);
  assert.equal(validateWellness({ kind: 'weight', date, weight_kg: 47.3 }, tz).weight_kg, 47.3);
  for (const data of [{ kind: 'weight', weight_kg: -1 }, { kind: 'sleep', sleep_hours: 25 }, { kind: 'energy', energy: 2.5 }, { kind: 'meal', description: '' }, { kind: 'meal', description: 'Nasi', calories: Infinity }]) assert.throws(() => validateWellness(data, tz));
  assert.throws(() => validateProfile({ user_id: 'another-account' }));
  assert.throws(() => validateProfile({ sleep_hours: 0 }));
  assert.deepEqual(validateProfile({ height_cm: 165, weight_kg: 47, calorie_target: null }), { height_cm: 165, weight_kg: 47, calorie_target: null });
});

test('foreign record corrections and undo operations cannot affect another account', async () => {
  await assert.rejects(executeLifeTool('log_wellness', { id: 'foreign', kind: 'weight', date, weight_kg: 50 }, 'user-A', tz), /tidak ditemukan/);
  await assert.rejects(undoLifeAction('user-A', 'foreign-audit'), /tidak dapat/);
  for (const q of queries.filter(q => q.sql.includes('WHERE id ='))) {
    assert.match(q.sql, /user_id = \$2/); assert.equal(q.params[1], 'user-A');
  }
  assert.ok(!queries.some(q => /^(UPDATE|DELETE)/.test(q.sql)));
});

test('undo refuses to erase a record changed by a later action', async () => {
  db.transaction = async work => work(async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('FROM ai_action_logs')) return [{ is_undone: false, result: { undo: [{ table: 'wellness_logs', id: 'owned', before: null, after: { id: 'owned', weight_kg: 47 } }] } }];
    if (sql.includes('FROM wellness_logs')) return [{ id: 'owned', weight_kg: 48 }];
    return [];
  });
  await assert.rejects(undoLifeAction('user-A', 'audit'), /sudah berubah/);
  assert.ok(!queries.some(q => q.sql.startsWith('DELETE')));
});

test('shift preview is read-only and saving all dates creates one auditable action', async () => {
  const rows = [{ date, code: 'L' }, { date: '2026-10-26', code: '1' }];
  const preview = await executeLifeTool('preview_shift_import', { rows }, 'user-A', tz);
  assert.equal(preview.draft.rows.length, 2); assert.equal(queries.length, 0);
  const uncertain = await executeLifeTool('preview_shift_import', { rows: [{ date, code: null }] }, 'user-A', tz);
  assert.equal(uncertain.draft.rows[0].code, null); assert.equal(queries.length, 0);
  const result = await executeLifeTool('save_shift_import', { rows }, 'user-A', tz);
  assert.equal(result.action_id, 'audit-A');
  assert.equal(queries.filter(q => q.sql.startsWith('INSERT INTO shift_assignments')).length, 2);
  const audit = queries.find(q => q.sql.startsWith('INSERT INTO ai_action_logs'));
  assert.equal(JSON.parse(audit.params[3]).undo.length, 2);
});

test('API checks authentication before accepting health and shift actions', async () => {
  auth.requireUser = async () => ({ error: 'Unauthorized' });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await handleAIRequest({ headers: {}, body: { action: 'life', op: 'save_shift_import', params: { rows: [{ date, code: 'L' }] } } }, response);
  assert.equal(response.statusCode, 401); assert.equal(queries.length, 0);
});

test('AI reads context then executes the requested action and returns a persistent undo card', async () => {
  db.queryOne = async sql => sql.includes('SELECT timezone') ? { timezone: tz } : sql.includes('FROM ai_conversations') ? { id: 'conversation-A' } : null;
  let rounds = 0;
  provider.callOpenRouter = async () => ({ candidates: [{ content: { parts: [{ functionCall: rounds++ === 0 ? { name: 'get_life_context', args: { date } } : { name: 'log_wellness', args: { kind: 'weight', date, weight_kg: 47.3 } } }] } }] });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await handleAIRequest({ headers: {}, body: { conversation_id: 'conversation-A', message: 'Catat berat saya 47,3' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.actions[0].action_id, 'audit-A');
  const saved = queries.find(q => q.sql.includes('INSERT INTO ai_messages'));
  assert.equal(JSON.parse(saved.params[4])[0].can_undo, true);
});
