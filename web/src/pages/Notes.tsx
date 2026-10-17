import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Button,
  changed,
  EmptyState,
  ErrorState,
  Fab,
  Field,
  Form,
  Icon,
  IconButton,
  LoadingState,
  messageOf,
  Modal,
  useCreatePanel,
  useFeedback,
  usePageLoad,
} from "../ui";
export default function Notes() {
  const nav = useNavigate();
  const panel = useCreatePanel("/notes");
  const feedback = useFeedback();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const load = useCallback(async () => {
    try {
      const r = await api.list("notes", {
        order_by: "updated_at",
        order_dir: "desc",
        limit: "100",
      });
      setNotes(r.data || []);
      setSearched(false);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  usePageLoad("/notes", load);
  const save = async () => {
    if (busy) return;
    if (!title.trim() && !content.trim()) {
      setFormError("Isi judul atau catatan terlebih dahulu.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api.create("notes", {
        title: title.trim() || "Tanpa judul",
        content,
      });
      setTitle("");
      setContent("");
      panel.close();
      feedback.notify("Catatan disimpan");
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching) return;
    if (!query.trim()) {
      void load();
      return;
    }
    setSearching(true);
    setError("");
    try {
      const r = await api.semanticSearch(query.trim());
      setNotes(r.results || []);
      setSearched(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSearching(false);
    }
  };
  const remove = async (n: any) => {
    if (busy || !(await feedback.confirm("Hapus catatan ini?"))) return;
    setBusy(true);
    try {
      await api.remove("notes", n.id);
      setDetail(null);
      feedback.notify("Catatan dihapus");
      changed();
    } catch (e) {
      feedback.notify(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="screen-scroll">
        <div className="content-width">
          <form className="search-form" onSubmit={search}>
            <input
              className="search-input"
              type="search"
              aria-label="Cari catatan"
              placeholder="Cari ide atau isi catatan"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <IconButton
              icon="search"
              label="Cari"
              type="submit"
              disabled={searching}
            />
          </form>
          <ErrorState message={error} onRetry={() => void load()} />
          <div className="section-heading section">
            <h2>{searched ? "Hasil pencarian" : "Semua catatan"}</h2>
            {searched && (
              <Button
                variant="text"
                onClick={() => {
                  setQuery("");
                  void load();
                }}
              >
                Lihat semua
              </Button>
            )}
          </div>
          {loading || searching ? (
            <LoadingState />
          ) : notes.length ? (
            <div className="list">
              {notes.map((n) => (
                <button
                  type="button"
                  className="list-row note-row"
                  key={n.id}
                  onClick={() => setDetail(n)}
                >
                  <span className="list-icon">
                    <Icon name="edit_note" />
                  </span>
                  <span className="copy">
                    <strong>{n.title || "Tanpa judul"}</strong>
                    <p className="clamp-2">{n.content}</p>
                    <p>
                      {n.updated_at
                        ? new Date(n.updated_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </p>
                  </span>
                  <Icon name="chevron_right" />
                </button>
              ))}
            </div>
          ) : (
            !error && (
              <EmptyState
                title={
                  searched
                    ? "Belum menemukan yang cocok"
                    : "Ide bagus dimulai di sini"
                }
                icon="edit_note"
              >
                {searched
                  ? "Coba kata lain untuk mencari catatan."
                  : "Simpan ide, rencana, atau hal yang ingin diingat."}
              </EmptyState>
            )
          )}
        </div>
      </div>
      <Fab label="Catatan baru" onClick={() => nav("/notes?new=1")} />
      <Modal
        full
        open={panel.open}
        title="Catatan baru"
        onClose={panel.close}
        busy={busy}
      >
        <Form onSubmit={save}>
          <Field label="Judul">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Isi catatan">
            <textarea
              className="note-body"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>
          <ErrorState message={formError} />
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan catatan"}
          </Button>
          <p className="meta">Draf tetap tersedia selama aplikasi terbuka.</p>
        </Form>
      </Modal>
      <Modal
        full
        open={!!detail}
        title={detail?.title || "Catatan"}
        onClose={() => setDetail(null)}
        busy={busy}
      >
        <article className="note-detail">{detail?.content}</article>
        <div className="form-actions">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => void remove(detail)}
          >
            <Icon name="delete" />
            Hapus catatan
          </Button>
        </div>
      </Modal>
    </>
  );
}
