import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  addDays,
  localDate,
  monthRange,
  rupiah,
  timeOf,
  todayStr,
} from "../api";
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
  Section,
  useCreatePanel,
  useFeedback,
  usePageLoad,
  type IconName,
} from "../ui";

type Resource = { data: any[]; error: string; loading: boolean };
const empty = (): Resource => ({ data: [], error: "", loading: true });
const quick: { title: string; to: string; icon: IconName }[] = [
  { title: "Tugas baru", to: "/?new=task", icon: "checklist" },
  { title: "Acara baru", to: "/calendar?new=1", icon: "event" },
  {
    title: "Pengeluaran",
    to: "/finance?new=1&type=expense",
    icon: "account_balance_wallet",
  },
  { title: "Catatan baru", to: "/notes?new=1", icon: "edit_note" },
];
export default function Dashboard({ user }: { user: any }) {
  const nav = useNavigate();
  const feedback = useFeedback();
  const panel = useCreatePanel("/", "task");
  const [data, setData] = useState<Record<string, Resource>>(() =>
    Object.fromEntries(
      ["events", "tasks", "habits", "logs", "brief", "tx", "plans"].map((k) => [
        k,
        empty(),
      ]),
    ),
  );
  const [quickOpen, setQuickOpen] = useState(false);
  const [allTasks, setAllTasks] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [briefBusy, setBriefBusy] = useState(false);
  const today = todayStr();
  const load = useCallback(async () => {
    const requests: Record<string, () => Promise<any>> = {
      events: () =>
        api.listAll("events", {
          filter_gte_start_time: new Date(`${today}T00:00:00`).toISOString(),
          filter_lt_start_time: new Date(
            `${addDays(today, 1)}T00:00:00`,
          ).toISOString(),
          order_by: "start_time",
          order_dir: "asc",
        }),
      tasks: () =>
        api.list("priorities", {
          filter_eq_date: today,
          order_by: "created_at",
          order_dir: "asc",
        }),
      habits: () => api.list("habits", { filter_eq_is_active: "true" }),
      logs: () => api.list("habit_logs", { filter_eq_date: today }),
      brief: () =>
        api.list("morning_briefs", { filter_eq_date: today, limit: "1" }),
      tx: () => api.listAll("transactions", monthRange(today.slice(0, 7))),
      plans: () => api.list("workout_plans", {}),
    };
    await Promise.allSettled(
      Object.entries(requests).map(async ([key, request]) => {
        try {
          const r = await request();
          setData((d) => ({
            ...d,
            [key]: { data: r.data || [], error: "", loading: false },
          }));
        } catch (e) {
          setData((d) => ({
            ...d,
            [key]: { ...d[key], error: messageOf(e), loading: false },
          }));
        }
      }),
    );
  }, [today]);
  usePageLoad("/", load);
  const mutate = async (id: string, action: () => Promise<unknown>) => {
    if (pending.includes(id)) return;
    setPending((p) => [...p, id]);
    try {
      await action();
      changed();
    } catch (e) {
      feedback.notify(messageOf(e));
    } finally {
      setPending((p) => p.filter((x) => x !== id));
    }
  };
  const addTask = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.create("priorities", { title: title.trim(), date: today });
      setTitle("");
      panel.close();
      feedback.notify("Tugas ditambahkan");
      changed();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const taskRow = (p: any) => (
    <div className={`list-row ${p.is_done ? "done" : ""}`} key={p.id}>
      <IconButton
        icon={p.is_done ? "check_circle" : "radio_button_unchecked"}
        label={`${p.is_done ? "Batalkan" : "Selesaikan"} ${p.title}`}
        disabled={pending.includes(p.id)}
        onClick={() =>
          void mutate(p.id, () =>
            api.update("priorities", p.id, { is_done: !p.is_done }),
          )
        }
      />
      <div className="copy">
        <strong>{p.title}</strong>
      </div>
      <IconButton
        icon="delete"
        label={`Hapus ${p.title}`}
        disabled={pending.includes(p.id)}
        onClick={async () => {
          if (await feedback.confirm("Hapus tugas ini?"))
            void mutate(p.id, () => api.remove("priorities", p.id));
        }}
      />
    </div>
  );
  const status = (key: string) =>
    data[key].loading ? (
      <LoadingState />
    ) : data[key].error ? (
      <ErrorState message={data[key].error} onRetry={() => void load()} />
    ) : null;
  const tasks = data.tasks.data;
  const events = data.events.data;
  const habits = data.habits.data;
  const logs = data.logs.data;
  const completed = habits.filter((h) =>
    logs.some((l) => l.habit_id === h.id && l.is_completed),
  ).length;
  const income = data.tx.data
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = data.tx.data
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const plan = data.plans.data.find((p) =>
    (p.day_of_week || []).includes(new Date().getDay()),
  );
  const genBrief = async () => {
    if (briefBusy) return;
    setBriefBusy(true);
    try {
      const r = await api.morningBrief(today);
      setData((d) => ({
        ...d,
        brief: { data: [{ content: r.brief }], loading: false, error: "" },
      }));
    } catch (e) {
      setData((d) => ({ ...d, brief: { ...d.brief, error: messageOf(e) } }));
    } finally {
      setBriefBusy(false);
    }
  };
  return (
    <>
      <div className="screen-scroll">
        <div className="content-width">
          <Section
            title={`Selamat datang, ${user?.display_name?.split(" ")[0] || "Pengguna"}`}
          >
            <p className="muted">Satu langkah, satu hal baik hari ini.</p>
          </Section>
          <Section
            title="Agenda hari ini"
            action={
              <Button variant="text" onClick={() => nav("/calendar")}>
                Lihat semua
              </Button>
            }
          >
            {status("events")}
            {!data.events.loading &&
              !data.events.error &&
              (events.length ? (
                <div className="list">
                  {events.slice(0, 3).map((e) => (
                    <button
                      type="button"
                      className="list-row"
                      key={e.id}
                      onClick={() => nav("/calendar")}
                    >
                      <span className="event-time">
                        <strong>{timeOf(e.start_time)}</strong>
                        <small>{timeOf(e.end_time)}</small>
                      </span>
                      <span className="copy">
                        <strong>{e.title}</strong>
                        {e.description && (
                          <p className="clamp-2">{e.description}</p>
                        )}
                      </span>
                      <Icon name="chevron_right" />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title="Ada ruang untuk dirimu" icon="event">
                  Belum ada agenda hari ini.
                </EmptyState>
              ))}
          </Section>
          <Section
            title="Prioritas"
            action={
              tasks.length > 3 ? (
                <Button variant="text" onClick={() => setAllTasks(true)}>
                  Lihat semua
                </Button>
              ) : undefined
            }
          >
            {status("tasks")}
            {!data.tasks.loading &&
              !data.tasks.error &&
              (tasks.length ? (
                <div className="list">{tasks.slice(0, 3).map(taskRow)}</div>
              ) : (
                <EmptyState title="Apa yang ingin kamu selesaikan?">
                  Tambahkan tugas lewat tombol Tambah.
                </EmptyState>
              ))}
          </Section>
          <Section
            title="Kebiasaan hari ini"
            action={
              <Button variant="text" onClick={() => nav("/habits")}>
                Buka
              </Button>
            }
          >
            {status("habits")}
            {status("logs")}
            {!data.habits.loading &&
              !data.logs.loading &&
              !data.habits.error &&
              !data.logs.error &&
              (habits.length ? (
                <div className="card">
                  <div className="row between">
                    <span>
                      {completed} dari {habits.length} selesai
                    </span>
                    <Icon name="check_circle" />
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label="Kebiasaan selesai"
                    aria-valuemin={0}
                    aria-valuemax={habits.length}
                    aria-valuenow={completed}
                  >
                    <div
                      style={{ width: `${(completed / habits.length) * 100}%` }}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {habits.slice(0, 3).map((h) => {
                      const done = logs.some(
                        (l) => l.habit_id === h.id && l.is_completed,
                      );
                      return (
                        <button
                          className="list-row"
                          type="button"
                          key={h.id}
                          disabled={pending.includes(h.id)}
                          aria-pressed={done}
                          onClick={() =>
                            void mutate(h.id, () =>
                              api.upsert(
                                "habit_logs",
                                {
                                  habit_id: h.id,
                                  date: today,
                                  value: done ? 0 : Number(h.target_value ?? 1),
                                  is_completed: !done,
                                },
                                "habit_id,date",
                              ),
                            )
                          }
                        >
                          <Icon
                            name={
                              done ? "check_circle" : "radio_button_unchecked"
                            }
                          />
                          <span className="copy">{h.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState title="Mulai dari kebiasaan kecil">
                  Kelola kebiasaanmu di Ruang Saya.
                </EmptyState>
              ))}
          </Section>
          <Section
            title="Ringkasan Atlas"
            action={
              <Button
                variant="text"
                disabled={briefBusy || data.brief.loading}
                onClick={() => void genBrief()}
              >
                {briefBusy
                  ? "Menyusun…"
                  : data.brief.data.length
                    ? "Perbarui"
                    : "Buatkan"}
              </Button>
            }
          >
            {status("brief")}
            {!data.brief.loading && (
              <div className="card tonal-card">
                <div className="row">
                  <Icon name="auto_awesome" />
                  <strong>Ruang untuk merencanakan</strong>
                </div>
                {data.brief.data[0]?.content ? (
                  <>
                    <p className={`brief-copy ${expanded ? "" : "clamp-3"}`}>
                      {data.brief.data[0].content}
                    </p>
                    <Button
                      variant="text"
                      onClick={() => setExpanded((v) => !v)}
                      aria-expanded={expanded}
                    >
                      {expanded ? "Ringkas" : "Baca selengkapnya"}
                    </Button>
                  </>
                ) : (
                  <p className="muted" style={{ marginTop: 12 }}>
                    Minta Atlas membantu merangkum harimu.
                  </p>
                )}
              </div>
            )}
          </Section>
          <Section
            title="Keuangan bulan ini"
            action={
              <Button variant="text" onClick={() => nav("/finance")}>
                Buka
              </Button>
            }
          >
            {status("tx")}
            {!data.tx.loading && !data.tx.error && (
              <div className="card">
                <p className="meta">Sisa dari pemasukan</p>
                <p className="number">{rupiah(income - expense)}</p>
                <p className="meta">Pengeluaran {rupiah(expense)}</p>
              </div>
            )}
          </Section>
          <Section title="Gerak hari ini">
            {status("plans")}
            {!data.plans.loading && !data.plans.error && (
              <button
                type="button"
                className="list-row list"
                onClick={() => nav("/workout")}
              >
                <span className="list-icon">
                  <Icon name="fitness_center" />
                </span>
                <span className="copy">
                  <strong>{plan?.name || "Hari untuk beristirahat"}</strong>
                  <p>
                    {plan
                      ? "Buka program latihanmu"
                      : "Lihat program dan riwayat workout"}
                  </p>
                </span>
                <Icon name="chevron_right" />
              </button>
            )}
          </Section>
        </div>
      </div>
      <Fab label="Tambah" onClick={() => setQuickOpen(true)} />
      <Modal
        open={quickOpen}
        title="Tambahkan ke harimu"
        onClose={() => setQuickOpen(false)}
      >
        <div className="choice-grid">
          {quick.map((q) => (
            <button
              className="list-row"
              type="button"
              key={q.to}
              onClick={() => {
                setQuickOpen(false);
                nav(q.to);
              }}
            >
              <span className="list-icon">
                <Icon name={q.icon} />
              </span>
              <span className="copy">
                <strong>{q.title}</strong>
              </span>
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={panel.open}
        title="Tugas baru"
        onClose={panel.close}
        busy={busy}
      >
        <Form onSubmit={addTask}>
          <Field label="Apa yang perlu diselesaikan?">
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <ErrorState message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan tugas"}
          </Button>
        </Form>
      </Modal>
      <Modal
        open={allTasks}
        title="Prioritas hari ini"
        onClose={() => setAllTasks(false)}
      >
        <div className="list">{tasks.map(taskRow)}</div>
      </Modal>
    </>
  );
}
