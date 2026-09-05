import { useCallback, useEffect, useRef, useState } from 'react';
import { api, todayStr, rupiah, timeOf } from '../api';

export default function Dashboard({ user }: { user: any }) {
  const today = todayStr();
  const [priorities, setPriorities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [newPriority, setNewPriority] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, ev, tx, br] = await Promise.all([
        api.list('priorities', { filter_eq_date: today, order_by: 'created_at', order_dir: 'asc' }),
        api.list('events', {
          filter_gte_start_time: `${today}T00:00:00`,
          filter_lte_start_time: `${today}T23:59:59`,
          order_by: 'start_time',
          order_dir: 'asc',
        }),
        api.list('transactions', { limit: '200' }),
        api.list('morning_briefs', { filter_eq_date: today, limit: '1' }),
      ]);
      setPriorities(p.data ?? []);
      setEvents(ev.data ?? []);
      setTxs(tx.data ?? []);
      setBrief(br.data?.[0]?.content ?? null);
    } catch (e: any) {
      setErr(e.message);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const month = today.slice(0, 7);
  const monthTx = txs.filter((t) => (t.occurred_at ?? '').slice(0, 7) === month);
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const addPriority = async () => {
    if (!newPriority.trim()) return;
    await api.create('priorities', { title: newPriority.trim(), date: today });
    setNewPriority('');
    load();
  };
  const togglePriority = async (p: any) => {
    await api.update('priorities', p.id, { is_done: !p.is_done });
    load();
  };
  const removePriority = async (id: string) => {
    await api.remove('priorities', id);
    load();
  };
  const genBrief = async () => {
    setBriefBusy(true);
    setErr('');
    try {
      const r = await api.morningBrief(today);
      setBrief(r.brief);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBriefBusy(false);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setChatInput('');
    setChatMsgs((m) => [...m, { role: 'user', content: text }]);
    setChatBusy(true);
    try {
      let id = convId;
      if (!id) {
        const conv = await api.create('ai_conversations', { title: 'Chat' });
        id = conv.data.id;
        setConvId(id);
      }
      const r = await api.aiChat(text, id);
      setChatMsgs((m) => [...m, { role: 'assistant', content: r.message ?? '(kosong)' }]);
    } catch (e: any) {
      setChatMsgs((m) => [...m, { role: 'assistant', content: '⚠️ ' + e.message }]);
    } finally {
      setChatBusy(false);
    }
  };

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [chatMsgs, chatBusy]);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
  })();

  return (
    <div>
      <h1>
        {greeting}, {user?.display_name ?? user?.email?.split('@')[0]} 👋
      </h1>
      <p className="page-sub">{today}</p>
      {err && <div className="error-box">{err}</div>}

      <div className="grid cols-3">
        <div className="card">
          <h3>Pemasukan (bulan ini)</h3>
          <div className="stat-value green">{rupiah(income)}</div>
        </div>
        <div className="card">
          <h3>Pengeluaran (bulan ini)</h3>
          <div className="stat-value red">{rupiah(expense)}</div>
        </div>
        <div className="card">
          <h3>Prioritas hari ini</h3>
          <div className="stat-value">
            {priorities.filter((p) => p.is_done).length}/{priorities.length} selesai
          </div>
        </div>
      </div>

      <div className="section card">
        <h3 style={{ marginBottom: 8 }}>🤖 Tanya AI Copilot</h3>
        <div className="chat-box" ref={chatRef} style={{ height: 260 }}>
          {chatMsgs.length === 0 && !chatBusy && (
            <p className="empty" style={{ margin: 'auto' }}>
              Mis. "Catat pengeluaran makan siang 25rb" atau "Buatkan plan workout push hari 1"
            </p>
          )}
          {chatMsgs.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {chatBusy && <div className="bubble assistant">Mengetik…</div>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="grow"
            placeholder="Ketik perintah untuk AI…"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            disabled={chatBusy}
          />
          <button className="btn" onClick={sendChat} disabled={chatBusy || !chatInput.trim()}>
            Kirim
          </button>
        </div>
      </div>

      <div className="section card">
        <div className="row between">
          <h3 style={{ marginBottom: 0 }}>☀️ Morning Brief</h3>
          <button className="btn small" onClick={genBrief} disabled={briefBusy}>
            {briefBusy ? 'Menyusun…' : brief ? 'Regenerate' : 'Generate'}
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          {brief ? (
            <div className="brief">{brief}</div>
          ) : (
            <p className="empty">Belum ada brief hari ini. Klik Generate untuk membuat ringkasan harian dengan AI.</p>
          )}
        </div>
      </div>

      <div className="grid cols-2 section">
        <div className="card">
          <h3>🎯 Prioritas Hari Ini</h3>
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              className="grow"
              placeholder="Tambah prioritas…"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPriority()}
            />
            <button className="btn" onClick={addPriority}>
              +
            </button>
          </div>
          {priorities.length === 0 && <p className="empty">Belum ada prioritas hari ini.</p>}
          {priorities.map((p) => (
            <div key={p.id} className={`item ${p.is_done ? 'done' : ''}`}>
              <input type="checkbox" checked={!!p.is_done} onChange={() => togglePriority(p)} />
              <span className="title">{p.title}</span>
              <button className="btn danger" onClick={() => removePriority(p.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>📅 Agenda Hari Ini</h3>
          {events.length === 0 && <p className="empty">Tidak ada event hari ini.</p>}
          {events.map((ev) => (
            <div key={ev.id} className="item">
              <span className="dot" style={{ background: ev.color ?? '#088395' }} />
              <div className="title">
                <div>{ev.title}</div>
                <div className="meta">
                  {timeOf(ev.start_time)} – {timeOf(ev.end_time)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
