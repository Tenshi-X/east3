import { useCallback, useEffect, useState } from 'react';

export default function Notes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchUsed, setSearchUsed] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.list('notes', { order_by: 'updated_at', order_dir: 'desc', limit: '100' });
      setNotes(r.data ?? []);
      setSearchUsed(false);
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async () => {
    if (!title.trim() && !content.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api.create('notes', { title: title.trim() || 'Untitled', content });
      setTitle('');
      setContent('');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (id: string) => {
    await api.remove('notes', id);
    load();
  };

  const search = async () => {
    if (!query.trim()) return load();
    setSearching(true);
    setErr('');
    try {
      const r = await api.semanticSearch(query.trim());
      setNotes(r.results ?? []);
      setSearchUsed(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <h1>🧠 Second Brain</h1>
      <p className="page-sub">Catat & cari catatan dengan semantic search (AI)</p>
      {err && <div className="error-box">{err}</div>}

      <div className="card">
        <h3>🔍 Cari Catatan (Semantic)</h3>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="grow"
            placeholder='mis. "ide bisnis" atau "cara tidur lebih baik"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <button className="btn" onClick={search} disabled={searching}>
            {searching ? 'Mencari…' : 'Cari'}
          </button>
        </div>
      </div>

      <div className="card section">
        <h3>➕ Catatan Baru</h3>
        <input
          className="full"
          placeholder="Judul"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <textarea
          className="full"
          placeholder="Isi catatan…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <button className="btn" onClick={addNote} disabled={busy}>
          Simpan
        </button>
      </div>

      <div className="section">
        <div className="row between" style={{ marginBottom: 10 }}>
          <span className="meta">{searchUsed ? `Hasil pencarian: ${notes.length}` : `${notes.length} catatan`}</span>
          {searchUsed && (
            <button className="btn ghost small" onClick={load}>
              Lihat semua
            </button>
          )}
        </div>
        {notes.length === 0 && <p className="empty">Belum ada catatan.</p>}
        {notes.map((n) => (
          <div key={n.id} className="card" style={{ marginBottom: 10 }}>
            <div className="row between">
              <h3 style={{ marginBottom: 0 }}>{n.title}</h3>
              <button className="btn danger" onClick={() => removeNote(n.id)}>
                ✕
              </button>
            </div>
            <p style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{n.content}</p>
            <p className="meta" style={{ marginTop: 8 }}>
              {(n.updated_at ?? '').slice(0, 16).replace('T', ' ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
