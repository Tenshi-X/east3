import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

export default function AICopilot() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api
      .list('ai_conversations', { order_by: 'updated_at', order_dir: 'desc', limit: '1' })
      .then(async (r) => {
        const id = r.data?.[0]?.id;
        if (!id) return;
        const history = await api.listAll('ai_messages', { filter_eq_conversation_id: id, order_by: 'created_at', order_dir: 'asc' });
        if (active) { setConvId(id); setMessages(history.data); }
      })
      .catch((e) => { if (active) setErr(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if ((!text && !imageFile) || busy || loading) return;
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
    <div className="ai-page">
      <p className="page-sub">Asisten AI yang bisa kelola data Anda lewat bahasa natural</p>
      {err && <div className="error-box">{err}</div>}

      <div className="chat-box" ref={boxRef}>
        {loading && <p className="empty">Memuat percakapan…</p>}
        {!loading && messages.length === 0 && (
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
        <div className="attachment-preview">
          <img src={imageFile} alt="Preview lampiran" />
          <button className="btn danger small" onClick={() => setImageFile(null)}>✖ Batal</button>
        </div>
      )}

      <div className="chat-composer">
        <label className="attach-button" aria-label="Lampirkan gambar">
          📎
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 3 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
                setErr('Gunakan gambar PNG, JPEG, WebP, atau GIF maksimal 3 MB');
                e.target.value = '';
                return;
              }
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
          disabled={busy || loading}
        />
        <button className="btn" onClick={send} disabled={busy || loading || (!input.trim() && !imageFile)}>
          Kirim
        </button>
      </div>
      <p className="meta" style={{ marginTop: 8 }}>
        Atlas memakai model AI gratis. Respons dapat tertunda saat layanan sedang sibuk.
      </p>
    </div>
  );
}
