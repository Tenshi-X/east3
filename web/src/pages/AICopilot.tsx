import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

export default function AICopilot() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .list('ai_conversations', { order_by: 'updated_at', order_dir: 'desc', limit: '1' })
      .then((r) => {
        if (r.data?.[0]) setConvId(r.data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if ((!text && !imageFile) || busy) return;
    setInput('');
    setErr('');
    setMessages((m) => [...m, { role: 'user', content: text || '(Kirim gambar)' }]);
    setBusy(true);
    try {
      let id = convId;
      if (!id) {
        const conv = await api.create('ai_conversations', { title: 'Chat' });
        id = conv.data.id;
        setConvId(id);
      }
      const sentImage = imageFile;
      setImageFile(null); // Clear image immediately on send
      
      const r = await api.aiChat(text, id!, sentImage ?? undefined);
      setMessages((m) => [...m, { role: 'assistant', content: r.reply ?? r.message ?? '(kosong)' }]);
    } catch (e: any) {
      setErr(e.message);
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>🤖 AI Copilot</h1>
      <p className="page-sub">Asisten AI yang bisa kelola data Anda lewat bahasa natural</p>
      {err && <div className="error-box">{err}</div>}

      <div className="chat-box" ref={boxRef}>
        {messages.length === 0 && (
          <p className="empty" style={{ margin: 'auto' }}>
            Mulai chat, mis. "Catat pengeluaran makan siang 25rb" atau "Buatkan plan workout push hari ini"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="bubble assistant">⏳ Berpikir…</div>}
      </div>

      {imageFile && (
        <div style={{ padding: '8px', background: 'var(--surface-color)', borderRadius: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
          <img src={imageFile} alt="Preview" style={{ height: '48px', width: 'auto', borderRadius: '4px', objectFit: 'cover' }} />
          <button className="btn" style={{ padding: '4px 12px', background: 'var(--danger-color)', minWidth: 0, height: '32px' }} onClick={() => setImageFile(null)}>✖ Batal</button>
        </div>
      )}

      <div className="row" style={{ gap: 8 }}>
        <label className="btn-icon" style={{ cursor: 'pointer', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '24px' }}>
          📎
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setImageFile(ev.target?.result as string);
              reader.readAsDataURL(file);
              e.target.value = ''; // Reset
            }} 
          />
        </label>
        <input
          className="grow"
          placeholder="Tulis pesan…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={busy}
        />
        <button className="btn" onClick={send} disabled={busy || (!input.trim() && !imageFile)}>
          Kirim
        </button>
      </div>
      <p className="meta" style={{ marginTop: 8 }}>
        Butuh OPENROUTER_API_KEY aktif di Netlify agar AI bisa menjawab & mengeksekusi tools (model free met fallback automatis).
      </p>
    </div>
  );
}
