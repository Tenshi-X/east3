import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HabitProgress from "../HabitProgress";
import LifePanel from "../LifePanel";
import CardCarousel from "../CardCarousel";
import { useLocalDay } from "../useLocalDay";
import { habitDone, habitStep, habitTarget } from "../habits";
import {
  api,
  invalidateData,
  localDate,
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
  ProgressRing,
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
  const [taskDuration, setTaskDuration] = useState("15");
  const [taskDue, setTaskDue] = useState("");
  const [taskEnergy, setTaskEnergy] = useState("low");
  const [taskFixed, setTaskFixed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [briefBusy, setBriefBusy] = useState(false);
  const today = useLocalDay();
  const load = useCallback(async () => {
    try {
      const result = await api.dashboard(today);
      setData((previous) =>
        Object.fromEntries(
          Object.entries(previous).map(([key, resource]) => {
            const next = result.resources?.[key];
            return [
              key,
              {
                data: next?.error
                  ? resource.data
                  : (next?.data ?? resource.data),
                error:
                  next?.error ||
                  (!next ? "Data belum dapat dimuat. Coba lagi." : ""),
                loading: false,
              },
            ];
          }),
        ),
      );
    } catch (error) {
      setData((previous) =>
        Object.fromEntries(
          Object.entries(previous).map(([key, resource]) => [
            key,
            { ...resource, error: messageOf(error), loading: false },
          ]),
        ),
      );
    }
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
      await api.create("priorities", {
        title: title.trim(),
        date: today,
        duration_minutes: Number(taskDuration),
        due_date: taskDue || null,
        energy: taskEnergy,
        is_fixed: taskFixed,
      });
      setTitle("");
      setTaskDuration("15");
      setTaskDue("");
      setTaskEnergy("low");
      setTaskFixed(false);
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
          void mutate(p.id, async () => {
            const patch = (isDone: boolean) =>
              setData((current) => ({
                ...current,
                tasks: {
                  ...current.tasks,
                  data: current.tasks.data.map((task) =>
                    task.id === p.id ? { ...task, is_done: isDone } : task,
                  ),
                },
              }));
            patch(!p.is_done);
            try {
              await api.update("priorities", p.id, { is_done: !p.is_done });
            } catch (error) {
              patch(p.is_done);
              throw error;
            }
          })
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
      <ErrorState
        message={data[key].error}
        onRetry={() => {
          invalidateData();
          void load();
        }}
      />
    ) : null;
  const tasks = data.tasks.data;
  const events = data.events.data;
  const habits = data.habits.data;
  const logs = data.logs.data;
  const habitLog = (id: string) =>
    logs.find((l) => l.habit_id === id && localDate(l.date) === today);
  const completed = habits.filter((h) => habitDone(h, habitLog(h.id))).length;
  const tasksDone = tasks.filter((task) => task.is_done).length;
  const tasksReady = !data.tasks.loading && !data.tasks.error;
  const habitsReady =
    !data.habits.loading &&
    !data.habits.error &&
    !data.logs.loading &&
    !data.logs.error;
  const eventsReady = !data.events.loading && !data.events.error;
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
        <div className="content-width dashboard-page">
          <section className="day-overview" aria-labelledby="day-heading">
            <div className="day-overview-main">
              <div className="day-copy">
                <p className="day-greeting">
                  Selamat datang,{" "}
                  {user?.display_name?.split(" ")[0] || "Pengguna"}
                </p>
                <h2 id="day-heading">Harimu, satu per satu.</h2>
                <p className="muted">
                  {tasksReady
                    ? tasks.length
                      ? tasksDone === tasks.length
                        ? "Prioritas hari ini sudah selesai. Beri waktu untuk dirimu."
                        : `${tasks.length - tasksDone} prioritas masih menunggu. Mulai dari yang paling penting.`
                      : "Belum ada prioritas. Tentukan satu hal yang ingin kamu selesaikan."
                    : data.tasks.error
                      ? "Prioritas belum dapat dimuat. Coba lagi dari kartu Prioritas."
                      : "Menyiapkan ringkasan harimu."}
                </p>
                <Button variant="tonal day-action" onClick={() => nav("/plan")}>
                  <Icon name="schedule" />
                  Lihat rencana
                </Button>
              </div>
              {tasksReady ? (
                <ProgressRing
                  value={tasksDone}
                  total={tasks.length}
                  label="Prioritas selesai"
                />
              ) : (
                <div className="day-ring-placeholder">
                  <Icon name="checklist" />
                </div>
              )}
            </div>
            <div className="day-metrics" aria-label="Ringkasan hari ini">
              <Link to="/calendar" className="day-metric">
                <Icon name="event" />
                <span>
                  <strong>{eventsReady ? events.length : "-"}</strong>
                  <span>agenda</span>
                </span>
              </Link>
              <Link to="/habits" className="day-metric">
                <Icon name="check_circle" />
                <span>
                  <strong>
                    {habitsReady ? `${completed}/${habits.length}` : "-"}
                  </strong>
                  <span>kebiasaan</span>
                </span>
              </Link>
              <Link to="/finance" className="day-metric">
                <Icon name="account_balance_wallet" />
                <span>
                  <strong className="metric-link-label">Keuangan</strong>
                  <span>bulan ini</span>
                </span>
              </Link>
            </div>
          </section>
          <LifePanel />
          <CardCarousel title="Aktivitas hari ini" icon="calendar_month">
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
                        style={{
                          width: `${(completed / habits.length) * 100}%`,
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {habits.slice(0, 3).map((h) => {
                        const log = habitLog(h.id);
                        const done = habitDone(h, log);
                        return (
                          <div className="habit-item" key={h.id}>
                            <div className="list-row">
                              <IconButton
                                icon={
                                  done
                                    ? "check_circle"
                                    : "radio_button_unchecked"
                                }
                                label={`${done ? "Batalkan check-in" : "Check-in"} ${h.name}`}
                                disabled={pending.includes(h.id)}
                                aria-pressed={done}
                                onClick={() =>
                                  void mutate(h.id, () => {
                                    const date = todayStr();
                                    const complete = !habitDone(
                                      h,
                                      logs.find(
                                        (l) =>
                                          l.habit_id === h.id &&
                                          localDate(l.date) === date,
                                      ),
                                    );
                                    return api.upsert(
                                      "habit_logs",
                                      {
                                        habit_id: h.id,
                                        date,
                                        value: complete ? habitTarget(h) : 0,
                                        is_completed: complete,
                                      },
                                      "habit_id,date",
                                    );
                                  })
                                }
                              />
                              <span className="copy">{h.name}</span>
                            </div>
                            <HabitProgress
                              habit={h}
                              value={Number(log?.value || 0)}
                              pending={pending.includes(h.id)}
                              onIncrement={(direction) =>
                                void mutate(h.id, () =>
                                  api.incrementHabit(
                                    h.id,
                                    todayStr(),
                                    Math.round(habitStep(h) * direction * 100) /
                                      100,
                                  ),
                                )
                              }
                            />
                          </div>
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
          </CardCarousel>
          <CardCarousel title="Ringkasan & program" icon="edit_note">
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
                    <Icon name="edit_note" />
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
                <div className="card dashboard-finance">
                  <p className="meta">Sisa dari pemasukan</p>
                  <p className="number">{rupiah(income - expense)}</p>
                  <p className="meta">Pengeluaran {rupiah(expense)}</p>
                  <div className="finance-mini-split">
                    <span>
                      Pemasukan<strong>{rupiah(income)}</strong>
                    </span>
                    <span>
                      Pengeluaran<strong>{rupiah(expense)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </Section>
            <Section title="Program workout">
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
                    <strong>{plan?.name || "Program & riwayat latihan"}</strong>
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
          </CardCarousel>
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
          <details>
            <summary>Durasi, tenggat & tenaga (opsional)</summary>
            <div className="field-pair">
              <Field label="Durasi tugas (menit)">
                <input
                  type="number"
                  min="5"
                  max="240"
                  step="1"
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(e.target.value)}
                />
              </Field>
              <Field label="Tenggat tugas">
                <input
                  type="date"
                  min={today}
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Tenaga yang diperlukan">
              <select
                value={taskEnergy}
                onChange={(e) => setTaskEnergy(e.target.value)}
              >
                <option value="low">Ringan</option>
                <option value="medium">Sedang</option>
                <option value="high">Besar</option>
              </select>
            </Field>
            <Field label="Jadwal tugas tetap">
              <input
                type="checkbox"
                checked={taskFixed}
                onChange={(e) => setTaskFixed(e.target.checked)}
              />
            </Field>
          </details>
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
