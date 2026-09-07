import { useCallback, useEffect, useState } from 'react';
import { api, timeOf } from '../api';

const COLORS = ['#3B82F6', '#16A34A', '#F59E0B', '#EF4444', '#A855F7', '#0EA5E9'];
const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function keyOf(date: Date) {
return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
const [events, setEvents] = useState<any[]>([]);
const [err, setErr] = useState('');
const [busy, setBusy] = useState(false);
const [view, setView] = useState<'day' | 'week' | 'month'>('month');
const [sel, setSel] = useState(new Date());
const [title, setTitle] = useState('');
const [date, setDate] = useState(keyOf(new Date()));
const [start, setStart] = useState('09:00');
const [end, setEnd] = useState('10:00');
const [color, setColor] = useState(COLORS[0]);
const [nl, setNl] = useState('');
const [nlBusy, setNlBusy] = useState(false);

const setSelectedDate = (d: Date) => { setSel(d); setDate(keyOf(d)); };

const load = useCallback(async () => {
try {
const r = await api.list('events', { order_by: 'start_time', order_dir: 'asc', limit: '300' });
setEvents(r.data ?? []);
} catch (e: any) { setErr(e.message); }
}, []);

useEffect(() => { load(); }, [load]);
useEffect(() => { setDate(keyOf(new Date())); }, []);

const addEvent = async () => {
if (!title.trim()) return;
setBusy(true);
setErr('');
try {
await api.create('events', { title: title.trim(), start_time: `${date}T${start}:00`, end_time: `${date}T${end}:00`, color });
setTitle('');
load();
} catch (e: any) { setErr(e.message); }
finally { setBusy(false); }
};

const removeEvent = async (id: string) => { await api.remove('events', id); load(); };

const nlParse = async () => {
if (!nl.trim() || nlBusy) return;
setNlBusy(true);
setErr('');
try {
const conv = await api.create('ai_conversations', { title: nl.trim() });
await api.aiChat(nl.trim(), conv.data.id);
load();
} catch (e: any) { setErr('AI gagal memproses: ' + e.message); }
finally { setNlBusy(false); }
};

const byDay = (d: string) => events.filter(e => (e.start_time ?? '').slice(0, 10) === d);
const selKey = keyOf(sel);
const hasEvent = (d: string) => byDay(d).length > 0;

const monthStart = new Date(sel.getFullYear(), sel.getMonth(), 1);
const gridStart = new Date(monthStart);
gridStart.setDate(1 - monthStart.getDay());
const cells: Date[] = [];
for (let i = 0; i < 42; i++) {
const c = new Date(gridStart);
c.setDate(gridStart.getDate() + i);
cells.push(c);
}

const weekStart = new Date(sel);
weekStart.setDate(sel.getDate() - sel.getDay());
const weekDays = Array.from({ length: 7 }, (_x, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

const todayKey = keyOf(new Date());
const move = (dir: number) => { const d = new Date(sel); d.setDate(d.getDate() + dir); setSel(d); };
return (
<div>
{err && <div className="error-box">{err}</div>}

<div className="seg" style={{ marginBottom: 12 }}>
<button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>Hari</button>
<button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Minggu</button>
<button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Bulan</button>
</div>

<div className="card" style={{ marginBottom: 12 }}>
<h3>Tulis dengan bahasa sehari-hari</h3>
<p className="meta" style={{ marginBottom: 8 }}>Contoh: &quot;Meeting besok jam 9&quot; atau &quot;Gym tiap Senin Rabu Jumat&quot;</p>
<div className="row" style={{ gap: 8 }}>
<input className="grow" placeholder="Jadwalkan... (AI akan paham)" value={nl} onChange={(e) => setNl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nlParse()} />
<button className="btn" onClick={nlParse} disabled={nlBusy}>{nlBusy ? 'Memahami...' : 'Pahami'}</button>
</div>
</div>

<div className="card" style={{ marginBottom: 12 }}>
<div className="cal-header">
<button className="icon-btn" onClick={() => move(-1)}>&#8249;</button>
<div className="cal-title">{view === 'day' ? sel.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) : MONTHS[sel.getMonth()] + ' ' + sel.getFullYear()}</div>
<button className="icon-btn" onClick={() => move(1)}>&#8250;</button>
</div>

{view === 'month' && (
<div className="cal-grid">
{DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
{cells.map(c => {
const k = keyOf(c);
const inMonth = c.getMonth() === sel.getMonth();
return (
<button key={k} className={'cal-day' + (inMonth ? '' : ' other') + (k === todayKey ? ' today' : '') + (k === selKey ? ' selected' : '')} onClick={() => setSelectedDate(c)}>
{c.getDate()}
{hasEvent(k) && <span className="dots"><i /></span>}
</button>
);
})}
</div>
)}

{view === 'week' && (
<div className="row" style={{ gap: 4, alignItems: 'stretch' }}>
{weekDays.map(d => {
const k = keyOf(d);
return (
<div key={k} className="grow" style={{ flex: 1, minWidth: 0 }}>
<div className="cal-dow">{DOW[d.getDay()]}</div>
<button className={'cal-day' + (k === todayKey ? ' today' : '') + (k === selKey ? ' selected' : '')} onClick={() => setSelectedDate(d)}>{d.getDate()}</button>
{byDay(k).slice(0, 3).map(ev => <div key={ev.id} className="meta" style={{ fontSize: 10 }}>{ev.title}</div>)}
</div>
);
})}
</div>
)}

{view === 'day' && (
<div>
{byDay(selKey).length === 0 && <p className="empty">Tidak ada agenda pada hari ini.</p>}
{byDay(selKey).map(ev => (
<div key={ev.id} className="item">
<span className="dot" style={{ background: ev.color || COLORS[0] }} />
<div className="title"><div>{ev.title}</div><div className="meta">{timeOf(ev.start_time)} - {timeOf(ev.end_time)}</div></div>
<button className="btn danger small" onClick={() => removeEvent(ev.id)}>Hapus</button>
</div>
))}
</div>
)}
</div>

<div className="card" style={{ marginBottom: 12 }}>
<h3>Tambah Event Manual</h3>
<div className="row wrap" style={{ gap: 8 }}>
<input className="grow" placeholder="Judul event" value={title} onChange={(e) => setTitle(e.target.value)} />
<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
<input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
<select value={color} onChange={(e) => setColor(e.target.value)}>{COLORS.map(c => <option key={c} value={c}>{c}</option>)}</select>
<button className="btn" onClick={addEvent} disabled={busy}>Simpan</button>
</div>
</div>

<div className="section">
<h3 style={{ marginBottom: 12 }}>Semua Agenda</h3>
{events.map(ev => (
<div key={ev.id} className="item">
<span className="dot" style={{ background: ev.color || COLORS[0] }} />
<div className="title"><div>{ev.title}</div><div className="meta">{(ev.start_time ?? '').slice(0, 10)} {timeOf(ev.start_time)} - {timeOf(ev.end_time)}</div></div>
<button className="btn danger small" onClick={() => removeEvent(ev.id)}>Hapus</button>
</div>
))}
{events.length === 0 && <p className="empty">Belum ada event.</p>}
</div>
</div>
);
}
