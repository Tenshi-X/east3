import { useCallback, useEffect, useState } from 'react';
import { api, timeOf } from '../api';

const COLORS = ['#088395', '#f39c12', '#e74c3c', '#9b59b6', '#2ecc71', '#3498db'];

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [color, setColor] = useState(COLORS[0]);

  const load = useCallback(async () => {
    try {
      const r = await api.list('events', { order_by: 'start_time', order_dir: 'asc', limit: '200' });
      setEvents(r.data ?? []);
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addEvent = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api.create('events', {
        title: title.trim(),
        start_time: `${date}T${start}:00`,
        end_time: `${date}T${end}:00`,
        color,
      });
      setTitle('');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeEvent = async (id: string) => {
    await api.remove('events', id);
    load();
  };

  const byDate = events.reduce((acc: Record<string, any[]>, e) => {
    const d = (e.start_time ?? '').slice(0, 10);
    (acc[d] = acc[d] ?? []).push(e);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort();

  return (
    <div>
      <h1>📅 Calendar</h1>
      <p className="page-sub">Kelola agenda & jadwal Anda</p>
      {err && <div className="error-box">{err}</div>}

      <div className="card">
        <h3>➕ Event Baru</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <input className="grow" placeholder="Judul event" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            {COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="btn" onClick={addEvent} disabled={busy}>
            Simpan
          </button>
        </div>
      </div>

      <div className="section">
        {dates.length === 0 && <p className="empty">Belum ada event.</p>}
        {dates.map((d) => (
          <div key={d} className="card" style={{ marginBottom: 12 }}>
            <h3>{d}</h3>
            {byDate[d].map((ev) => (
              <div key={ev.id} className="item">
                <span className="dot" style={{ background: ev.color ?? '#088395' }} />
                <div className="title">
                  <div>{ev.title}</div>
                  <div className="meta">
                    {timeOf(ev.start_time)} – {timeOf(ev.end_time)}
                  </div>
                </div>
                <button className="btn danger" onClick={() => removeEvent(ev.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
