import { useCallback,useEffect,useRef,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api,todayStr,rupiah,timeOf } from '../api';

const SPLIT_LABEL: Record<string,string> = {
 push:'Push Day',
 pull:'Pull Day',
 legs:'Legs Day',
 upper:'Upper Day',
 lower:'Lower Day',
 full_body:'Full Body',
 custom:'Custom',
};

export default function Dashboard({ user }: { user:any }) {
 const today = todayStr();
 const [params] = useSearchParams();
 const focusTask = params.get('new') === 'task';
 const [events,setEvents] = useState<any[]>([]);
 const [brief,setBrief] = useState<string|null>(null);
 const [briefBusy,setBriefBusy] = useState(false);
 const [txs,setTxs] = useState<any[]>([]);
 const [plans,setPlans] = useState<any[]>([]);
 const [habits,setHabits] = useState<any[]>([]);
 const [logs,setLogs] = useState<any[]>([]);
 const [tasks,setTasks] = useState<any[]>([]);
 const [newTask,setNewTask] = useState('');
 const [newTaskOpen,setNewTaskOpen] = useState(focusTask);
 const [err,setErr] = useState('');
 const taskRef = useRef<HTMLInputElement>(null);

 const load = useCallback(async () => {
   try {
     const [ev,br,tx,pl,ha,lo,ta] = await Promise.all([
       api.list('events',{ filter_gte_start_time:`${today}T00:00:00`, filter_lte_start_time:`${today}T23:59:59`, order_by:'start_time', order_dir:'asc' }),
       api.list('morning_briefs',{ filter_eq_date:today, limit:'1' }),
       api.list('transactions',{ limit:'200' }),
       api.list('workout_plans',{}),
       api.list('habits',{ filter_eq_is_active:'true' }),
       api.list('habit_logs',{ filter_eq_date:today }),
       api.list('priorities',{ filter_eq_date:today, order_by:'created_at', order_dir:'asc' })
     ]);
     setEvents(ev.data ?? []);
     setBrief(br.data?.[0]?.content ?? null);
     setTxs(tx.data ?? []);
     setPlans(pl.data ?? []);
     setHabits(ha.data ?? []);
     setLogs(lo.data ?? []);
     setTasks(ta.data ?? []);
   } catch (e:any) { setErr(e.message); }
 }, [today]);

 useEffect(() => { load(); }, [load]);
 useEffect(() => { if (focusTask && taskRef.current) taskRef.current.focus(); }, [focusTask]);

 const month = today.slice(0, 7);
 const monthTx = txs.filter(t => (t.occurred_at ?? '').slice(0, 7) === month);
 const income = monthTx.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0);
 const expense = monthTx.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount),   0);
 const remaining = income - expense;

 const genBrief = async () => {
   setBriefBusy(true);
   setErr('');
   try { const r = await api.morningBrief(today); setBrief(r.brief); } catch (e:any) { setErr(e.message); } finally { setBriefBusy(false); }
 };
 const addTask = async () => {
   if (!newTask.trim()) return;
   await api.create('priorities',{ title:newTask.trim(), date:today });
   setNewTask('');
   load();
 };
 const toggleTask = async (p:any) => {
   await api.update('priorities', p.id, { is_done: !p.is_done });
   load();
 };
 const toggleHabit = async (h:any) => {
   const done = !!logs.find(l => l.habit_id === h.id && l.is_completed);
   await api.upsert('habit_logs',{ habit_id:h.id, date:today, value:done ? 0 : (h.target_value ?? 1), is_completed:!done }, 'habit_id,date');
   load();
 };
 const dow = new Date().getDay();
 const todaysPlan = plans.find(p => (p.day_of_week ?? []).includes(dow));
 const name = user?.display_name || 'Farel';

return (
<div>
{err && <div className="error-box">{err}</div>}
<section className="card lift">
<div className="row between">
<h3 style={{ marginBottom: 0 }}>Sun Morning Brief</h3>
<button className="btn small ghost" onClick={genBrief} disabled={briefBusy}>{briefBusy ? 'Menyusun...' : brief ? 'Perbarui' : 'Buatkan'}</button>
</div>
{brief ? <div className="brief">{brief}</div> : <p className="empty">Selamat pagi, {name}. Ketuk Buatkan agar AI merangkum harimu.</p>}
</section>
<section className="section">
<div className="row between" style={{ marginBottom: 12 }}><h3>Kalender Jadwal Hari Ini</h3></div>
{events.length === 0 ? <p className="empty">Tidak ada agenda hari ini.</p> : (
<div className="timeline">
{events.map(ev => (
<div key={ev.id} className="tl-item">
<div className="tl-time">{timeOf(ev.start_time)} - {timeOf(ev.end_time)}</div>
<div className="tl-title">{ev.title}</div>
{ev.description && <div className="tl-sub">{ev.description}</div>}
</div>
))}
</div>
)}
</section>
<section className="section">
<div className="row between" style={{ marginBottom: 12 }}><h3>Wallet Budget Bulan Ini</h3></div>
<div className="stat-grid">
<div className="stat-card"><div className="k">Pemasukan</div><div className="v green">{rupiah(income)}</div></div>
<div className="stat-card"><div className="k">Pengeluaran</div><div className="v red">{rupiah(expense)}</div></div>
<div className="stat-card"><div className="k">Sisa</div><div className="v blue">{rupiah(remaining)}</div></div>
</div>
</section>
<section className="section card">
<div className="row between" style={{ marginBottom: 12 }}><h3 style={{ marginBottom: 0 }}>Target Prioritas Hari Ini</h3></div>
{newTaskOpen ? (
<div className="row" style={{ marginBottom: 12 }}>
<input ref={taskRef} className="grow" placeholder="Tambah prioritas..." value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
<button className="btn" onClick={addTask}>+</button>
</div>
) : (
<button className="btn small ghost" style={{ marginBottom: 12 }} onClick={() => setNewTaskOpen(true)}>+ Tambah tugas</button>
)}
{tasks.length === 0 && <p className="empty">Belum ada prioritas.</p>}
{tasks.map(p => (
<div key={p.id} className={p.is_done ? 'item done' : 'item'}>
<input type="checkbox" checked={!!p.is_done} onChange={() => toggleTask(p)} />
<span className="title">{p.title}</span>
<button className="btn danger" onClick={() => api.remove('priorities', p.id).then(load)}>x</button>
</div>
))}
</section>

<section className="section">
<div className="row between" style={{ marginBottom: 12 }}><h3>Dumbbell Workout Hari Ini</h3></div>
{todaysPlan ? (
<div className="card lift">
<div className="row between">
<div>
<div style={{ fontWeight: 800, fontSize: 17 }}>{todaysPlan.name}</div>
<div className="tl-sub">{SPLIT_LABEL[todaysPlan.split_type] ?? todaysPlan.split_type}</div>
</div>
<span className="budget-chip">Latihan</span>
</div>
</div>
) : <p className="empty">Hari ini hari istirahat - tidak ada program latihan.</p>}
</section>
<section className="section">
<div className="row between" style={{ marginBottom: 12 }}><h3>Check Habit Hari Ini</h3></div>
{habits.length === 0 ? <p className="empty">Belum ada habit. Kelola lewat Profil &gt; Habits.</p> : habits.map(h => {
const done = !!logs.find(l => l.habit_id === h.id && l.is_completed);
return (
<button key={h.id} className="habit-row" onClick={() => toggleHabit(h)}>
<span className={done ? 'habit-check done' : 'habit-check'}>{done ? 'v' : ''}</span>
<span className="grow" style={{ textAlign: 'left' }}>{h.name}</span>
{h.icon && <span>{h.icon}</span>}
</button>
);
})}
</section>
</div>
);
}