import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function Workout() {
  const [plans, setPlans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [pName, setPName] = useState('');
  const [pSplit, setPSplit] = useState('push');
  const [pDay, setPDay] = useState('1');

  const [exName, setExName] = useState('');
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('0');

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([
        api.list('workout_plans', { order_by: 'day_of_week', order_dir: 'asc' }),
        api.list('workout_logs', { order_by: 'performed_at', order_dir: 'desc', limit: '50' }),
      ]);
      setPlans(p.data ?? []);
      setLogs(l.data ?? []);
      const planIds = (p.data ?? []).map((x: any) => x.id);
      const allSets = planIds.length ? await api.list('workout_sets', { limit: '500' }) : { data: [] };
      setSets(allSets.data ?? []);
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addPlan = async () => {
    if (!pName.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api.create('workout_plans', { name: pName.trim(), split_type: pSplit, day_of_week: Number(pDay) });
      setPName('');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removePlan = async (id: string) => {
    await api.remove('workout_plans', id);
    load();
  };

  const logWorkout = async (plan: any) => {
    setBusy(true);
    setErr('');
    try {
      const log = await api.create('workout_logs', { plan_id: plan.id, performed_at: new Date().toISOString() });
      if (exName.trim()) {
        await api.create('workout_sets', {
          workout_log_id: log.id,
          exercise_name: exName.trim(),
          set_number: 1,
          reps: Number(exReps) || 10,
          weight_kg: Number(exWeight) || 0,
        });
      }
      setExName('');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const logIdToPlan: Record<string, any> = {};
  for (const l of logs) logIdToPlan[l.id] = l.plan_id;
  const setsByLog = sets.reduce((acc: Record<string, any[]>, s) => {
    (acc[s.workout_log_id] = acc[s.workout_log_id] ?? []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <h1>🏋️ Workout Copilot</h1>
      <p className="page-sub">Rencana latihan & riwayat workout</p>
      {err && <div className="error-box">{err}</div>}

      <div className="card">
        <h3>➕ Rencana Latihan</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <input className="grow" placeholder="Nama plan (mis. Push Day A)" value={pName} onChange={(e) => setPName(e.target.value)} />
          <select value={pSplit} onChange={(e) => setPSplit(e.target.value)}>
            {['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={pDay} onChange={(e) => setPDay(e.target.value)}>
            {['1', '2', '3', '4', '5', '6', '7'].map((d) => (
              <option key={d} value={d}>
                Hari {d}
              </option>
            ))}
          </select>
          <button className="btn" onClick={addPlan} disabled={busy}>
            Simpan
          </button>
        </div>
      </div>

      <div className="grid cols-2 section">
        {plans.length === 0 && <p className="empty">Belum ada rencana latihan.</p>}
        {plans.map((p) => (
          <div key={p.id} className="card">
            <div className="row between">
              <h3 style={{ marginBottom: 0 }}>{p.name}</h3>
              <span className="meta">{p.split_type}</span>
            </div>
            <p className="meta" style={{ margin: '6px 0 12px' }}>
              Hari {p.day_of_week}
            </p>
            <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
              <input
                className="grow"
                placeholder="Latihan (mis. Bench Press)"
                value={exName}
                onChange={(e) => setExName(e.target.value)}
              />
              <input type="number" value={exReps} onChange={(e) => setExReps(e.target.value)} style={{ width: 70 }} />
              <input type="number" value={exWeight} onChange={(e) => setExWeight(e.target.value)} style={{ width: 90 }} />
            </div>
            <button className="btn full" onClick={() => logWorkout(p)} disabled={busy}>
              ✅ Log Workout Sekarang
            </button>
            <button className="btn danger full" style={{ marginTop: 6 }} onClick={() => removePlan(p.id)}>
              Hapus plan
            </button>
          </div>
        ))}
      </div>

      <div className="section card">
        <h3>📜 Riwayat Workout</h3>
        {logs.length === 0 && <p className="empty">Belum ada riwayat.</p>}
        {logs.map((l) => {
          const plan = plans.find((p) => p.id === l.plan_id);
          const ls = setsByLog[l.id] ?? [];
          return (
            <div key={l.id} className="item" style={{ alignItems: 'flex-start' }}>
              <div className="title">
                <div>{plan?.name ?? 'Workout'}</div>
                <div className="meta">
                  {(l.performed_at ?? '').slice(0, 16).replace('T', ' ')}
                  {ls.length > 0 && ` — ${ls.length} set`}
                </div>
                {ls.length > 0 && (
                  <div className="meta" style={{ marginTop: 4 }}>
                    {ls.map((s) => `${s.exercise_name} ${s.reps}x@${s.weight_kg}kg`).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
