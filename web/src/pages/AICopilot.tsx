import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  Button,
  changed,
  ErrorState,
  Icon,
  IconButton,
  messageOf,
} from "../ui";
type Message = { role: string; content: string; image?: string };
export default function AICopilot({ active = true }: { active?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const loadHistory = async () => {
    setLoading(true);
    setHistoryFailed(false);
    setError("");
    try {
      const r = await api.list("ai_conversations", {
        order_by: "updated_at",
        order_dir: "desc",
        limit: "1",
      });
      const id = r.data?.[0]?.id;
      if (id) {
        const history = await api.listAll("ai_messages", {
          filter_eq_conversation_id: id,
          order_by: "created_at",
          order_dir: "asc",
        });
        setConvId(id);
        setMessages(history.data || []);
      }
    } catch (e) {
      setError(messageOf(e));
      setHistoryFailed(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadHistory();
  }, []);
  useEffect(() => {
    if (active && stick.current)
      boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [messages, busy, active, loading]);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "48px";
    el.style.height = `${Math.min(144, Math.max(48, el.scrollHeight))}px`;
  }, [input, active]);
  const send = async () => {
    const text = input.trim();
    if ((!text && !imageFile) || busy || loading || reading || historyFailed)
      return;
    setBusy(true);
    setError("");
    stick.current = true;
    const image = imageFile;
    setMessages((m) => [
      ...m,
      { role: "user", content: text || "(Gambar)", image: image || undefined },
    ]);
    try {
      let id = convId;
      if (!id) {
        const conv = await api.create("ai_conversations", {
          title: text.slice(0, 60) || "Gambar",
        });
        id = conv.data.id;
        setConvId(id);
      }
      const r = await api.aiChat(text, id!, image || undefined);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: r.reply ?? r.message ?? "Permintaan selesai.",
        },
      ]);
      setInput("");
      setImageFile(null);
      changed();
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setError(`${messageOf(e)} Pesan belum terkirim. Draf tetap tersedia.`);
    } finally {
      setBusy(false);
      textRef.current?.focus();
    }
  };
  const readFile = (file: File) => {
    if (
      file.size > 3 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      setError("Gunakan gambar PNG, JPEG, WebP, atau GIF maksimal 3 MB.");
      return;
    }
    setReading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      setImageFile(String(reader.result));
      setReading(false);
    };
    reader.onerror = () => {
      setError("Gambar tidak dapat dibaca. Coba pilih lagi.");
      setReading(false);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="chat-layout">
      <div
        className="messages"
        ref={boxRef}
        role="log"
        aria-label="Percakapan Atlas AI"
        aria-busy={loading || busy}
        onScroll={() => {
          const box = boxRef.current!;
          stick.current =
            box.scrollHeight - box.scrollTop - box.clientHeight < 80;
        }}
      >
        {loading && (
          <p role="status" className="meta">
            Memuat percakapan…
          </p>
        )}
        {!loading && !historyFailed && messages.length === 0 && (
          <div className="chat-welcome">
            <Icon name="auto_awesome" />
            <h2>Ada yang bisa Atlas bantu?</h2>
            <p className="muted">Ceritakan rencanamu atau catat sesuatu.</p>
            <div className="suggestions">
              {[
                "Catat pengeluaran makan siang 25 ribu",
                "Apa agenda saya hari ini?",
                "Bantu susun prioritas hari ini",
              ].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => {
                    setInput(s);
                    textRef.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble ${m.role === "user" ? "user" : "assistant"}`}
            aria-label={m.role === "user" ? "Anda" : "Atlas"}
          >
            {m.image && <img src={m.image} alt="Gambar yang dikirim" />}
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant" role="status">
            Atlas sedang menyiapkan jawaban…
          </div>
        )}
      </div>
      <div className="chat-footer">
        <ErrorState
          message={error}
          onRetry={historyFailed ? () => void loadHistory() : undefined}
        />
        {imageFile && (
          <div className="attachment-preview">
            <img src={imageFile} alt="Pratinjau lampiran" />
            <span className="grow meta">Gambar siap dikirim</span>
            <IconButton
              icon="close"
              label="Hapus lampiran"
              disabled={busy}
              onClick={() => setImageFile(null)}
            />
          </div>
        )}
        <div className="chat-composer">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-label="Pilih gambar"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = "";
            }}
          />
          <IconButton
            icon="attach_file"
            label="Lampirkan gambar"
            disabled={busy || reading}
            onClick={() => fileRef.current?.click()}
          />
          <textarea
            rows={1}
            ref={textRef}
            aria-label="Pesan untuk Atlas"
            placeholder="Tulis pesan…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy || loading || historyFailed}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <IconButton
            className="send-button"
            icon="send"
            label="Kirim pesan"
            disabled={
              busy ||
              loading ||
              reading ||
              historyFailed ||
              (!input.trim() && !imageFile)
            }
            onClick={() => void send()}
          />
        </div>
        <p className="chat-caption">
          {reading
            ? "Menyiapkan gambar…"
            : "Atlas memakai AI. Periksa kembali informasi penting."}
        </p>
      </div>
    </div>
  );
}
