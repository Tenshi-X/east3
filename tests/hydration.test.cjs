const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ transpileOnly: true, compilerOptions: { rootDir: '.' } });
const hydration = require('../shared/hydration');
const { shiftTimes, zonedTime, localDay, dayAdd } = require('../shared/life');
const manual = { ...hydration.DEFAULT_HYDRATION, mode: 'manual' };
const zone = 'Asia/Jakarta';
const at = (date, clock) => Date.parse(zonedTime(date, clock, zone));
const shift = (date, code) => ({ date, code, ...shiftTimes(date, code, zone) });

test('water reminders stay within the chosen window, including night shifts', () => {
  assert.deepEqual(hydration.hydrationSlots(hydration.DEFAULT_HYDRATION), [480, 600, 720, 840, 960, 1080, 1200]);
  assert.deepEqual(hydration.hydrationSlots({ start: '22:30', end: '06:00', interval: 120 }), [1350, 30, 150, 270]);
  assert.throws(() => hydration.hydrationSlots({ start: '08:00', end: '08:00', interval: 60 }));
  assert.throws(() => hydration.hydrationSlots({ start: '24:00', end: '22:00', interval: 60 }));
  assert.throws(() => hydration.hydrationSlots({ start: '08:00', end: '22:00', interval: 1 }));
});

test('next reminder skips past times and moves to tomorrow after the active window', () => {
  const settings = hydration.DEFAULT_HYDRATION;
  const date = new Date(2026, 9, 31, 20, 0, 0);
  assert.equal(hydration.nextHydrationTime(settings, date).getTime(), new Date(2026, 10, 1, 8, 0, 0).getTime());
  assert.equal(hydration.nextHydrationTime(settings, new Date(2026, 9, 31, 9, 50)).getHours(), 10);
  const overnight = { start: '22:30', end: '06:00', interval: 120 };
  assert.equal(hydration.nextHydrationTime(overnight, new Date(2026, 9, 31, 23, 0)).getTime(), new Date(2026, 10, 1, 0, 30).getTime());
});

function client() {
  const storage = new Map();
  const calls = [], events = [];
  let granted = true, fail = false;
  let loader = async () => hydration.buildHydrationSchedule({ date: localDay(new Date(), zone), timezone: zone });
  const plugin = {
    checkPermission: async () => ({ granted }),
    requestPermission: async () => ({ granted }),
    configure: async value => { if (fail) throw new Error('device unavailable'); calls.push(value); },
  };
  const js = ts.transpileModule(fs.readFileSync('web/src/hydration.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, {
    module: mod, exports: mod.exports,
    require: name => name === '@capacitor/core' ? { Capacitor: { getPlatform: () => 'android' }, registerPlugin: () => plugin }
      : name === './api' ? { api: { life: () => loader() } } : hydration,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    window: { dispatchEvent: event => events.push(event) }, Event: class { constructor(type) { this.type = type; } },
  });
  return { ...mod.exports, calls, storage, events, deny: () => { granted = false; }, fail: () => { fail = true; }, load: fn => { loader = fn; } };
}

test('schedules persist per account, disable on logout, and restore only for their owner', async () => {
  const app = client();
  await app.syncHydration('A');
  await app.saveHydration('A', { ...manual, enabled: true });
  assert.equal(app.calls.at(-1).enabled, true);
  assert.equal(app.calls.at(-1).startMinute, 480);
  const scheduled = app.calls.length;
  await app.syncHydration('A');
  assert.equal(app.calls.length, scheduled, 'resume must not postpone the existing alarm');
  await app.syncHydration('B');
  assert.equal(app.calls.at(-1).enabled, false);
  assert.equal(app.readHydration('B').enabled, false);
  await app.syncHydration('A');
  assert.equal(app.calls.at(-1).enabled, true);
  await app.saveHydration('A', { ...manual, enabled: false });
  assert.equal(app.calls.at(-1).enabled, false);
  await app.syncHydration(null);
  assert.equal(app.calls.at(-1).userId, '');
});

test('revoked permissions disable the native alarm without opening another prompt', async () => {
  const app = client();
  await app.syncHydration('A');
  await app.saveHydration('A', { ...manual, enabled: true });
  app.deny();
  await app.syncHydration('A');
  assert.equal(app.calls.at(-1).enabled, false);
  assert.equal(app.readHydration('A').enabled, true);
  await assert.rejects(app.requestHydrationPermission(), /Izinkan notifikasi/);
});

test('a failed schedule is not reported as saved, and a delayed save cannot undo logout', async () => {
  const app = client();
  await app.syncHydration('A');
  app.fail();
  await assert.rejects(app.saveHydration('A', { ...manual, enabled: true }));
  assert.equal(app.storage.size, 0);
  assert.equal(app.events.length, 0);
  const other = client();
  await other.syncHydration('A');
  await other.syncHydration(null);
  await assert.rejects(other.saveHydration('A', { ...hydration.DEFAULT_HYDRATION, enabled: true }), /Akun sudah berubah/);
  assert.equal(other.calls.at(-1).enabled, false);
});

test('automatic reminders follow early, late, night, combined shifts, naps, and recovery', () => {
  const date = '2026-10-31', tomorrow = dayAdd(date, 1);
  const early = hydration.buildHydrationSchedule({ date, timezone: zone, shifts: [shift(date, '1')] });
  assert.equal(hydration.hydrationAwake(early, at(date, '04:29')), false);
  assert.equal(hydration.automaticHydrationTime(early, 120, at(date, '04:29')), at(date, '04:30'));
  const night = hydration.buildHydrationSchedule({ date, timezone: zone, shifts: [shift(date, '3'), shift(tomorrow, 'L')] });
  assert.equal(hydration.hydrationAwake(night, at(date, '19:30')), false, 'pre-shift nap');
  assert.equal(hydration.hydrationAwake(night, at(tomorrow, '02:00')), true, 'working overnight');
  assert.equal(hydration.hydrationAwake(night, at(tomorrow, '08:00')), false, 'recovery sleep');
  assert.equal(hydration.automaticHydrationTime(night, 120, at(tomorrow, '08:00')), at(tomorrow, '15:00'));
  for (const code of ['2', '1&2', '2&3']) {
    const schedule = hydration.buildHydrationSchedule({ date, timezone: zone, shifts: [shift(date, code)] });
    assert.equal(hydration.hydrationAwake(schedule, at(date, '16:00')), true);
    if (code === '2&3') assert.equal(hydration.hydrationAwake(schedule, at(tomorrow, '10:00')), false);
    assert.equal(hydration.validHydrationSchedule(schedule), true);
  }
});

test('automatic reminders honor custom sleep, retain overnight cadence, and stop after expiry', () => {
  const date = '2026-10-31';
  const schedule = hydration.buildHydrationSchedule({ date, timezone: zone, profile: { wake_time: '09:00', bed_time: '01:00', sleep_hours: 8 } });
  assert.equal(hydration.hydrationAwake(schedule, at(date, '08:30')), false);
  assert.equal(hydration.automaticHydrationTime(schedule, 120, at(date, '08:30')), at(date, '09:00'));
  assert.equal(hydration.hydrationAwake(schedule, at(date, '01:00')), false);
  const night = hydration.buildHydrationSchedule({ date, timezone: zone, shifts: [shift(date, '3')] });
  assert.equal(hydration.automaticHydrationTime(night, 120, at(dayAdd(date, 1), '00:01')), at(dayAdd(date, 1), '01:00'));
  assert.equal(hydration.automaticHydrationTime(schedule, 120, schedule.validUntil), null);
  assert.equal(hydration.hydrationAwake(schedule, schedule.validUntil), false);
  assert.equal(hydration.validHydrationSchedule({ ...schedule, windows: [{ start: 2, end: 1 }] }), false);
});

test('automatic schedules resync after a profile change, keep offline cache, and never use fixed hours on failure', async () => {
  const app = client();
  await app.syncHydration('A');
  await app.saveHydration('A', { ...hydration.DEFAULT_HYDRATION, enabled: true });
  assert.equal(app.calls.at(-1).automatic, true);
  assert.ok(app.calls.at(-1).windows.length > 0);
  const oldWindows = JSON.stringify(app.calls.at(-1).windows);
  app.load(async () => hydration.buildHydrationSchedule({ date: localDay(new Date(), zone), timezone: zone, profile: { wake_time: '09:00', bed_time: '01:00' } }));
  await app.syncHydration('A', true);
  assert.notEqual(JSON.stringify(app.calls.at(-1).windows), oldWindows);
  const savedWindows = JSON.stringify(app.calls.at(-1).windows);
  app.load(async () => { throw new Error('offline'); });
  await app.syncHydration('A', true);
  assert.equal(JSON.stringify(app.calls.at(-1).windows), savedWindows);
  assert.equal(app.calls.at(-1).enabled, true);
  const empty = client();
  await empty.syncHydration('B');
  empty.load(async () => { throw new Error('offline'); });
  await assert.rejects(empty.saveHydration('B', { ...hydration.DEFAULT_HYDRATION, enabled: true }), /belum dapat dimuat/);
  assert.equal(empty.readHydration('B').enabled, false);
});

test('a pending automatic refresh cannot delay logout or restore the previous account alarm', async () => {
  const app = client();
  await app.syncHydration('A');
  await app.saveHydration('A', { ...hydration.DEFAULT_HYDRATION, enabled: true });
  let finish;
  app.load(() => new Promise(resolve => { finish = resolve; }));
  const loading = app.syncHydration('A', true);
  await app.syncHydration(null);
  assert.equal(app.calls.at(-1).enabled, false);
  finish(hydration.buildHydrationSchedule({ date: localDay(new Date(), zone), timezone: zone }));
  await loading;
  assert.equal(app.calls.at(-1).userId, '');
});

test('corrupt stored settings fall back to a disabled default', () => {
  const app = client();
  app.storage.set('atlas:hydration:A', '{invalid');
  assert.equal(app.readHydration('A').enabled, false);
  app.storage.set('atlas:hydration:A', JSON.stringify({ enabled: true, interval: 0 }));
  assert.equal(app.readHydration('A').enabled, false);
});
