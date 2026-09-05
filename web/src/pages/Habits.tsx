import { useCallback, useEffect, useState } from 'react';
import { api, todayStr } from '../api';

export default function Habits() {
  const [habits, setHabits] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [freq, setFreq] = useState('daily');
  const [color, setColor] = useState('#3fb950');

  const load = useCallback(async () => {
    try {
      const [h, l] = await Promise.all([
        api.list('habits', { order_by: 'created_at', order_dir: 'asc' }),
        api.list('habit_logs', { limit: '500' }),
      ]);
      setHabits(h.data ?? []);
      setLogs(l.data ?? []);
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayStr();

  const addHabit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api.create('habits', { name: name.trim(), frequency: freq, color });
      setName('');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleToday = async (habit: any) => {
    const existing = logs.find((l) => l.habit_id === habit.id && (l.log_date ?? '').slice(0, 10) === today);
    setBusy(true);
    try {
      if (existing) {
        await api.remove('habit_logs', existing.id);
      } else {
        await api.create('habit_logs', { habit_id: habit.id, log_date: today, completed: true });
      }
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeHabit = async (id: string) => {
    await api.remove('habits', id);
    load();
  };

  const doneToday = (habitId: string) =>
    logs.some((l) => l.habit_id === habitId && (l.log_date ?? '').slice(0, 10) === today);

  const streakOf = (habitId: string) => {
    const dates = new Set(
      logs.filter((l) => l.habit_id === habitId).map((l) => (l.log_date ?? '').slice(0, 10))
    );
    let streak = 0;
    const d = new Date();
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (dates.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return streak;
  };

  return (
    <div>
      <h1>✅ Habit Tracker</h1>
      <p className="page-sub">Bangun kebiasaan baik, satu hari demi satu hari</p>
      {err && <div className="error-box">{err}</div>}

      <div className="card">
        <h3>➕ Habit Baru</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <input className="grow" placeholder="Nama habit (mis. Minum 2L air)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={freq} onChange={(e) => setFreq(e.target.value)}>
            <option value="daily">Harian</option>
            <option value="weekly">Mingguan</option>
          </select>
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            {['#3fb950', '#088395', '#f39c12', '#e74c3c', '#9b59b6'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="btn" onClick={addHabit} disabled={busy}>
            Simpan
          </button>
        </div>
      </div>

      <div className="section">
        {habits.length === 0 && <p className="empty">Belum ada habit. Buat yang pertama!</p>}
        {habits.map((h) => {
          const done = doneToday(h.id);
          const streak = streakOf(h.id);
          return (
            <div key={h.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row between">
                <div className="row">
                  <span className="dot" style={{ background: h.color ?? '#3fb950' }} />
                  <div>
                    <div>{h.name}</div>
                    <div className="meta">
                      {h.frequency} · 🔥 streak {streak} hari
                    </div>
                  </div>
                </div>
                <div className="row">
                  <button className={`btn ${done ? 'ghost' : ''} small`} onClick={() => toggleToday(h)} disabled={busy}>
                    {done ? `✓ ${today}` : 'Check-in hari ini'}
                  </button>
                  <button className="btn danger" onClick={() => removeHabit(h.id)}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
