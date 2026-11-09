import { useEffect, useState } from "react";
import { todayStr } from "../api";
import { Button, ErrorState, Field, Form, messageOf } from "../ui";
import { dictate } from "../personalDevice";
import {
  discardCapture,
  enqueueCapture,
  pendingCaptures,
  retryCaptures,
  type Capture as CaptureRow,
} from "../personalQueue";
const kinds: Record<string, string> = {
  expense: "Pengeluaran",
  task: "Tugas",
  note: "Catatan",
  meal: "Makanan",
  energy: "Energi",
  sleep: "Tidur",
};
export default function Capture({ userId }: { userId: string }) {
  const [kind, setKind] = useState("expense"),
    [content, setContent] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(todayStr()),
    [category, setCategory] = useState("food");
  const [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<CaptureRow[]>([]);
  useEffect(() => {
    const refresh = () => {
      try {
        setPending(pendingCaptures(userId));
      } catch (e) {
        setError(messageOf(e));
      }
    };
    refresh();
    window.addEventListener("atlas:queue", refresh);
    return () => window.removeEventListener("atlas:queue", refresh);
  }, [userId]);
  const numeric = ["sleep", "energy"].includes(kind);
  return (
    <div className="screen-scroll">
      <div className="content-width personal-stack">
        <section className="card personal-stack">
          <h2>Catat sekarang, lanjutkan harimu</h2>
          <p className="meta">
            Catatan masuk antrean di perangkat ini sebelum dikirim. Saat
            offline, jangan hapus data aplikasi sampai sinkronisasi selesai.
          </p>
          <Form
            onSubmit={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              setInfo("");
              try {
                const queued = await enqueueCapture(userId, {
                  kind,
                  date,
                  ...(numeric ? { value: Number(amount) } : { content }),
                  ...(kind === "expense"
                    ? { amount: Number(amount), category }
                    : {}),
                });
                setContent("");
                setAmount("");
                setInfo(
                  queued
                    ? "Tersimpan di perangkat. Menunggu sinkronisasi."
                    : "Catatan tersimpan di akunmu.",
                );
              } catch (e) {
                setError(messageOf(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Jenis catatan">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setAmount("");
                }}
              >
                {Object.entries(kinds).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal catatan">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            {!numeric && (
              <Field
                label={kind === "meal" ? "Apa yang kamu makan?" : "Isi catatan"}
              >
                <textarea
                  required={kind !== "expense"}
                  maxLength={kind === "note" ? 10000 : 2000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </Field>
            )}
            {(numeric || kind === "expense") && (
              <Field
                label={
                  kind === "sleep"
                    ? "Durasi tidur (jam)"
                    : kind === "energy"
                      ? "Energi (1–5)"
                      : "Jumlah (Rp)"
                }
              >
                <input
                  type="number"
                  required
                  min={kind === "sleep" ? 0 : kind === "energy" ? 1 : 0.01}
                  max={kind === "sleep" ? 24 : kind === "energy" ? 5 : 1e10}
                  step={kind === "energy" ? 1 : 0.01}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            )}
            {kind === "expense" && (
              <Field label="Kategori">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="food">Makanan</option>
                  <option value="transport">Transportasi</option>
                  <option value="shopping">Belanja</option>
                  <option value="utilities">Tagihan</option>
                  <option value="other">Lainnya</option>
                </select>
              </Field>
            )}
            <div className="personal-actions">
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan catatan"}
              </Button>
              {!numeric && (
                <Button
                  variant="tonal"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      setContent(await dictate());
                    } catch (e) {
                      setError(messageOf(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Isi dengan suara
                </Button>
              )}
            </div>
          </Form>
          <ErrorState message={error} />
          {info && <p role="status">{info}</p>}
        </section>
        <section className="card personal-stack">
          <h2>Menunggu sinkronisasi ({pending.length})</h2>
          {!pending.length && (
            <p className="meta">Semua catatan sudah terkirim.</p>
          )}
          {pending.map((r) => (
            <div key={r.id} className="personal-row">
              <div>
                <strong>{kinds[r.kind]}</strong>
                <p className="meta">
                  {r.content || r.value || r.amount} · {r.date}
                </p>
                {r.error && <p role="alert">{r.error}</p>}
              </div>
              <Button
                variant="text"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm("Hapus catatan ini dari antrean perangkat?")
                  )
                    discardCapture(userId, r.id);
                }}
              >
                Hapus antrean
              </Button>
            </div>
          ))}
          {!!pending.length && (
            <Button
              variant="tonal"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await retryCaptures(userId);
                } catch (e) {
                  setError(messageOf(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Coba sinkronkan
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}
