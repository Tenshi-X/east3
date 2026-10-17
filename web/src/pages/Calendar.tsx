import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, addDays, localDate, timeOf, todayStr } from "../api";
import {
  Button,
  changed,
  EmptyState,
  ErrorState,
  Fab,
  Field,
  Form,
  IconButton,
  LoadingState,
  messageOf,
  Modal,
  Section,
  Segments,
  useCreatePanel,
  useFeedback,
  usePageLoad,
} from "../ui";
const COLORS = [
  { value: "#3B82F6", label: "Biru" },
  { value: "#16A34A", label: "Hijau" },
  { value: "#F59E0B", label: "Kuning" },
  { value: "#EF4444", label: "Merah" },
  { value: "#A855F7", label: "Ungu" },
];
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export default function Calendar() {
  const nav = useNavigate();
  const panel = useCreatePanel("/calendar");
  const feedback = useFeedback();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [selected, setSelected] = useState(todayStr());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [color, setColor] = useState(COLORS[0].value);
  const [method, setMethod] = useState<"manual" | "ai">("manual");
  const [natural, setNatural] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await api.listAll("events", {
        order_by: "start_time",
        order_dir: "asc",
      });
      setEvents(r.data || []);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  usePageLoad("/calendar", load);
  const sel = new Date(`${selected}T12:00:00`);
  const weekStart = addDays(selected, -sel.getDay());
  const gridStart = new Date(sel.getFullYear(), sel.getMonth(), 1);
  gridStart.setDate(1 - gridStart.getDay());
  const days =
    view === "month"
      ? Array.from({ length: 42 }, (_, i) => addDays(todayStr(gridStart), i))
      : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const agenda = events.filter((e) => localDate(e.start_time) === selected);
  const move = (direction: number) => {
    if (view === "month") {
      const d = new Date(sel);
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
      setSelected(todayStr(d));
    } else
      setSelected(addDays(selected, direction * (view === "week" ? 7 : 1)));
  };
  const openNew = () => {
    setDate(selected);
    setFormError("");
    nav("/calendar?new=1");
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      if (method === "ai") {
        if (!natural.trim())
          throw new Error("Tulis agenda yang ingin ditambahkan.");
        const conv = await api.create("ai_conversations", {
          title: natural.trim(),
        });
        await api.aiChat(natural.trim(), conv.data.id);
        setNatural("");
        feedback.notify(
          "Permintaan diproses. Periksa agenda yang ditambahkan Atlas.",
        );
      } else {
        if (!title.trim()) throw new Error("Isi judul acara.");
        const from = new Date(`${date}T${start}:00`);
        const to = new Date(`${date}T${end}:00`);
        if (!Number.isFinite(from.getTime()) || to <= from)
          throw new Error("Waktu selesai harus setelah waktu mulai.");
        await api.create("events", {
          title: title.trim(),
          start_time: from.toISOString(),
          end_time: to.toISOString(),
          color,
        });
        setSelected(date);
        setTitle("");
        feedback.notify("Acara ditambahkan");
      }
      panel.close();
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (event: any) => {
    if (busy || !(await feedback.confirm("Hapus acara ini?"))) return;
    setBusy(true);
    try {
      await api.remove("events", event.id);
      changed();
      feedback.notify("Acara dihapus");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="screen-scroll">
        <div className="content-width">
          <Segments
            label="Tampilan kalender"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "Hari" },
              { value: "week", label: "Minggu" },
              { value: "month", label: "Bulan" },
            ]}
          />
          <div className="calendar-toolbar">
            <IconButton
              icon="chevron_left"
              label="Periode sebelumnya"
              onClick={() => move(-1)}
            />
            <h2>
              {sel.toLocaleDateString("id-ID", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <IconButton
              icon="chevron_right"
              label="Periode berikutnya"
              onClick={() => move(1)}
            />
          </div>
          {view === "month" && (
            <div className="compact-date">
              <Field label="Pilih tanggal">
                <input
                  type="date"
                  value={selected}
                  onChange={(e) => {
                    if (e.target.value) setSelected(e.target.value);
                  }}
                />
              </Field>
            </div>
          )}
          {view !== "month" && (
            <div className="compact-week">
              <div className="calendar-grid">
                {Array.from({ length: 5 }, (_, i) =>
                  addDays(selected, i - 2),
                ).map((key) => (
                  <div key={key}>
                    <div className="calendar-dow">
                      {DOW[new Date(`${key}T12:00:00`).getDay()]}
                    </div>
                    <button
                      type="button"
                      className="calendar-day"
                      aria-label={new Date(
                        `${key}T12:00:00`,
                      ).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                      aria-pressed={key === selected}
                      onClick={() => setSelected(key)}
                    >
                      {new Date(`${key}T12:00:00`).getDate()}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="calendar-card">
            <div className="calendar-grid">
              {DOW.map((d) => (
                <span className="calendar-dow" key={d}>
                  {d}
                </span>
              ))}
              {days.map((key) => {
                const d = new Date(`${key}T12:00:00`);
                return (
                  <button
                    type="button"
                    key={key}
                    aria-label={d.toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    aria-pressed={key === selected}
                    className={`calendar-day ${key === todayStr() ? "today" : ""} ${d.getMonth() !== sel.getMonth() ? "other" : ""}`}
                    onClick={() => setSelected(key)}
                  >
                    {d.getDate()}
                    {events.some((e) => localDate(e.start_time) === key) && (
                      <span className="event-dot" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <Button variant="text" onClick={() => setSelected(todayStr())}>
            Kembali ke hari ini
          </Button>
          <ErrorState message={error} onRetry={() => void load()} />
          <Section
            title={sel.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          >
            {loading ? (
              <LoadingState />
            ) : agenda.length ? (
              <div className="list">
                {agenda.map((e) => (
                  <div className="list-row" key={e.id}>
                    <span className="event-time">
                      <strong>{timeOf(e.start_time)}</strong>
                      <small>{timeOf(e.end_time)}</small>
                    </span>
                    <div className="copy">
                      <strong>{e.title}</strong>
                      {e.description && <p>{e.description}</p>}
                    </div>
                    <IconButton
                      icon="delete"
                      label={`Hapus ${e.title}`}
                      disabled={busy}
                      onClick={() => void remove(e)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              !error && (
                <EmptyState title="Belum ada agenda" icon="event">
                  Tambahkan acara untuk tanggal ini.
                </EmptyState>
              )
            )}
          </Section>
        </div>
      </div>
      <Fab label="Acara baru" onClick={openNew} />
      <Modal
        open={panel.open}
        title="Acara baru"
        onClose={panel.close}
        busy={busy}
      >
        <Segments
          label="Cara menambah acara"
          value={method}
          onChange={setMethod}
          options={[
            { value: "manual", label: "Isi sendiri" },
            { value: "ai", label: "Bantuan AI" },
          ]}
        />
        <Form onSubmit={save}>
          {method === "manual" ? (
            <>
              <Field label="Judul acara">
                <input
                  autoFocus
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Tanggal">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <div className="field-pair">
                <Field label="Mulai">
                  <input
                    type="time"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </Field>
                <Field label="Selesai">
                  <input
                    type="time"
                    required
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </Field>
              </div>
              <fieldset>
                <legend>Warna acara</legend>
                <div className="swatches">
                  {COLORS.map((c) => (
                    <button
                      className="swatch"
                      type="button"
                      key={c.value}
                      aria-label={c.label}
                      aria-pressed={color === c.value}
                      onClick={() => setColor(c.value)}
                    >
                      <span style={{ background: c.value }} />
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <Field
              label="Ceritakan agendamu"
              hint="Contoh: Meeting besok jam 9 sampai jam 10."
            >
              <textarea
                autoFocus
                required
                value={natural}
                onChange={(e) => setNatural(e.target.value)}
              />
            </Field>
          )}
          <ErrorState message={formError} />
          <Button type="submit" disabled={busy}>
            {busy
              ? "Menyimpan…"
              : method === "ai"
                ? "Tambahkan dengan AI"
                : "Simpan acara"}
          </Button>
        </Form>
      </Modal>
    </>
  );
}
