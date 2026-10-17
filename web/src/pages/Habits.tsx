import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, localDate, todayStr } from "../api";
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
const COLORS = [
  { value: "#3fb950", label: "Hijau" },
  { value: "#088395", label: "Toska" },
  { value: "#f39c12", label: "Kuning" },
  { value: "#e74c3c", label: "Merah" },
  { value: "#9b59b6", label: "Ungu" },
];
export default function Habits() {
  const nav = useNavigate();
  const panel = useCreatePanel("/habits");
  const feedback = useFeedback();
  const [habits, setHabits] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState("daily");
  const [color, setColor] = useState(COLORS[0].value);
  const load = useCallback(async () => {
    try {
      const [h, l] = await Promise.all([
        api.list("habits", { order_by: "created_at", order_dir: "asc" }),
        api.listAll("habit_logs"),
      ]);
      setHabits(h.data || []);
      setLogs(l.data || []);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  usePageLoad("/habits", load);
  const today = todayStr();
  const done = (id: string) =>
    logs.some(
      (l) => l.habit_id === id && localDate(l.date) === today && l.is_completed,
    );
  const completed = habits.filter((h) => done(h.id)).length;
  const streak = (id: string) => {
    const dates = new Set(
      logs
        .filter((l) => l.habit_id === id && l.is_completed)
        .map((l) => localDate(l.date)),
    );
    let count = 0;
    const d = new Date();
    while (dates.has(todayStr(d))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  };
  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      await api.create("habits", { name: name.trim(), frequency: freq, color });
      setName("");
      panel.close();
      feedback.notify("Kebiasaan ditambahkan");
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (h: any) => {
    if (pending.includes(h.id)) return;
    setPending((p) => [...p, h.id]);
    try {
      const complete = !done(h.id);
      await api.upsert(
        "habit_logs",
        {
          habit_id: h.id,
          date: today,
          value: complete ? Number(h.target_value ?? 1) : 0,
          is_completed: complete,
        },
        "habit_id,date",
      );
      changed();
    } catch (e) {
      feedback.notify(messageOf(e));
    } finally {
      setPending((p) => p.filter((id) => id !== h.id));
    }
  };
  const remove = async (h: any) => {
    if (
      pending.includes(h.id) ||
      !(await feedback.confirm("Hapus kebiasaan ini?"))
    )
      return;
    setPending((p) => [...p, h.id]);
    try {
      await api.remove("habits", h.id);
      changed();
      feedback.notify("Kebiasaan dihapus");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setPending((p) => p.filter((id) => id !== h.id));
    }
  };
  return (
    <>
      <div className="screen-scroll">
        <div className="content-width">
          <section className="card tonal-card">
            <p className="eyebrow">Langkah kecil hari ini</p>
            <p className="number">
              {completed}{" "}
              <span className="meta">dari {habits.length} selesai</span>
            </p>
            <div
              className="progress"
              role="progressbar"
              aria-label="Progres kebiasaan hari ini"
              aria-valuemin={0}
              aria-valuemax={Math.max(1, habits.length)}
              aria-valuenow={completed}
            >
              <div
                style={{
                  width: `${habits.length ? (completed / habits.length) * 100 : 0}%`,
                }}
              />
            </div>
          </section>
          <ErrorState message={error} onRetry={() => void load()} />
          <div className="section">
            {loading ? (
              <LoadingState />
            ) : habits.length ? (
              <div className="list">
                {habits.map((h) => (
                  <div
                    className={`list-row ${done(h.id) ? "done" : ""}`}
                    key={h.id}
                  >
                    <IconButton
                      icon={
                        done(h.id) ? "check_circle" : "radio_button_unchecked"
                      }
                      label={`${done(h.id) ? "Batalkan check-in" : "Check-in"} ${h.name}`}
                      aria-pressed={done(h.id)}
                      disabled={pending.includes(h.id)}
                      onClick={() => void toggle(h)}
                    />
                    <div className="copy">
                      <strong>
                        <span
                          className="habit-color"
                          style={{ background: h.color || "#2158b5" }}
                          aria-hidden="true"
                        />
                        {h.name}
                      </strong>
                      <p>
                        {h.frequency === "weekly" ? "Mingguan" : "Harian"} ·{" "}
                        {streak(h.id)} hari berturut-turut
                      </p>
                    </div>
                    <IconButton
                      icon="delete"
                      label={`Hapus ${h.name}`}
                      disabled={pending.includes(h.id)}
                      onClick={() => void remove(h)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              !error && (
                <EmptyState title="Mulai dari satu kebiasaan" icon="checklist">
                  Buat kebiasaan pertama yang ingin kamu bangun.
                </EmptyState>
              )
            )}
          </div>
        </div>
      </div>
      <Fab label="Kebiasaan baru" onClick={() => nav("/habits?new=1")} />
      <Modal
        open={panel.open}
        title="Kebiasaan baru"
        onClose={panel.close}
        busy={busy}
      >
        <Form onSubmit={save}>
          <Field label="Nama kebiasaan">
            <input
              autoFocus
              required
              placeholder="Contoh: Membaca 15 menit"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Frekuensi">
            <select value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
            </select>
          </Field>
          <fieldset>
            <legend>Warna kebiasaan</legend>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  type="button"
                  className="swatch"
                  key={c.value}
                  aria-label={c.label}
                  aria-pressed={color === c.value}
                  onClick={() => setColor(c.value)}
                >
                  <span style={{ background: c.value }} />
                  {color === c.value && <Icon name="check" />}
                </button>
              ))}
            </div>
          </fieldset>
          <ErrorState message={formError} />
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan kebiasaan"}
          </Button>
        </Form>
      </Modal>
    </>
  );
}
