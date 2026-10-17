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
  Segments,
  useCreatePanel,
  useFeedback,
  usePageLoad,
} from "../ui";
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const SPLITS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Kaki",
  upper: "Tubuh atas",
  lower: "Tubuh bawah",
  full_body: "Seluruh tubuh",
  custom: "Kustom",
};
export default function Workout() {
  const nav = useNavigate();
  const panel = useCreatePanel("/workout");
  const feedback = useFeedback();
  const [plans, setPlans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"plans" | "history">("plans");
  const [name, setName] = useState("");
  const [split, setSplit] = useState("push");
  const [day, setDay] = useState("1");
  const [selected, setSelected] = useState<any>(null);
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");
  const [logId, setLogId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([
        api.list("workout_plans", {
          order_by: "day_of_week",
          order_dir: "asc",
        }),
        api.list("workout_logs", {
          order_by: "date",
          order_dir: "desc",
          limit: "50",
        }),
      ]);
      const ids = (l.data || []).map((x: any) => x.id);
      const s = ids.length
        ? await api.listAll("workout_sets", {
            filter_in_workout_log_id: ids.join(","),
          })
        : { data: [] };
      setPlans(p.data || []);
      setLogs(l.data || []);
      setSets(s.data || []);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  usePageLoad("/workout", load);
  const addPlan = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      await api.create("workout_plans", {
        name: name.trim(),
        split_type: split,
        day_of_week: [Number(day)],
      });
      setName("");
      panel.close();
      feedback.notify("Program latihan disimpan");
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const openSession = (p: any) => {
    if (selected?.id !== p.id) {
      setExercise("");
      setReps("10");
      setWeight("0");
      setLogId(null);
    }
    setSelected(p);
    setFormError("");
  };
  const [sessionOpen, setSessionOpen] = useState(false);
  const saveWorkout = async () => {
    if (busy || !selected) return;
    setBusy(true);
    setFormError("");
    try {
      if (
        exercise.trim() &&
        (!Number.isInteger(Number(reps)) ||
          Number(reps) <= 0 ||
          !Number.isFinite(Number(weight)) ||
          Number(weight) < 0)
      )
        throw new Error("Isi repetisi positif dan beban minimal 0 kg.");
      let id = logId;
      if (!id) {
        const log = await api.create("workout_logs", {
          plan_id: selected.id,
          date: todayStr(),
        });
        id = log.data.id;
        setLogId(id);
      }
      if (exercise.trim())
        await api.create("workout_sets", {
          workout_log_id: id,
          exercise_name: exercise.trim(),
          set_number: 1,
          reps: Number(reps),
          weight: Number(weight),
        });
      setSessionOpen(false);
      setSelected(null);
      setLogId(null);
      setExercise("");
      feedback.notify("Latihan dicatat");
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (p: any) => {
    if (busy || !(await feedback.confirm("Hapus program ini?"))) return;
    setBusy(true);
    try {
      await api.remove("workout_plans", p.id);
      changed();
      feedback.notify("Program dihapus");
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
            label="Bagian workout"
            value={tab}
            onChange={setTab}
            options={[
              { value: "plans", label: "Program" },
              { value: "history", label: "Riwayat" },
            ]}
          />
          <ErrorState message={error} onRetry={() => void load()} />
          {loading ? (
            <LoadingState />
          ) : tab === "plans" ? (
            plans.length ? (
              <div className="list">
                {plans.map((p) => (
                  <div className="list-row" key={p.id}>
                    <button
                      type="button"
                      className="workout-link"
                      onClick={() => {
                        openSession(p);
                        setSessionOpen(true);
                      }}
                    >
                      <span className="list-icon">
                        <Icon name="fitness_center" />
                      </span>
                      <span className="copy">
                        <strong>{p.name}</strong>
                        <p>
                          {SPLITS[p.split_type] || p.split_type} ·{" "}
                          {(p.day_of_week || [])
                            .map((d: number) => DAYS[d])
                            .join(", ")}
                        </p>
                        <p className="action-copy">Catat latihan</p>
                      </span>
                    </button>
                    <IconButton
                      icon="delete"
                      label={`Hapus ${p.name}`}
                      disabled={busy}
                      onClick={() => void remove(p)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              !error && (
                <EmptyState
                  title="Temukan ritme latihanmu"
                  icon="fitness_center"
                >
                  Buat program latihan pertamamu.
                </EmptyState>
              )
            )
          ) : logs.length ? (
            <div className="stack">
              {logs.map((l) => (
                <section className="card" key={l.id}>
                  <p className="meta">
                    {new Date(
                      `${localDate(l.date)}T12:00:00`,
                    ).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <h2 style={{ marginTop: 4 }}>
                    {plans.find((p) => p.id === l.plan_id)?.name || "Latihan"}
                  </h2>
                  {sets
                    .filter((s) => s.workout_log_id === l.id)
                    .map((s) => (
                      <div className="list-row" key={s.id}>
                        <div className="copy">
                          <strong>{s.exercise_name}</strong>
                          <p>
                            {s.reps} repetisi · {s.weight} kg
                          </p>
                        </div>
                      </div>
                    ))}
                </section>
              ))}
            </div>
          ) : (
            !error && (
              <EmptyState
                title="Riwayatmu dimulai dari sini"
                icon="fitness_center"
              >
                Catat latihan dari program yang kamu pilih.
              </EmptyState>
            )
          )}
        </div>
      </div>
      {tab === "plans" && (
        <Fab
          label="Program baru"
          onClick={() => {
            setFormError("");
            nav("/workout?new=1");
          }}
        />
      )}
      <Modal
        full
        open={panel.open}
        title="Program latihan baru"
        onClose={panel.close}
        busy={busy}
      >
        <Form onSubmit={addPlan}>
          <Field label="Nama program">
            <input
              autoFocus
              required
              placeholder="Contoh: Push Day A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Jenis latihan">
            <select value={split} onChange={(e) => setSplit(e.target.value)}>
              {Object.entries(SPLITS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hari latihan">
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {DAYS[d]}
                </option>
              ))}
            </select>
          </Field>
          <ErrorState message={formError} />
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan program"}
          </Button>
        </Form>
      </Modal>
      <Modal
        full
        open={sessionOpen}
        title={selected?.name || "Catat latihan"}
        onClose={() => setSessionOpen(false)}
        busy={busy}
      >
        <Form onSubmit={saveWorkout}>
          <p className="muted">
            Catat sesi hari ini. Isian hanya berlaku untuk program ini.
          </p>
          <Field label="Nama latihan (opsional)">
            <input
              autoFocus
              placeholder="Contoh: Bench Press"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            />
          </Field>
          <div className="field-pair">
            <Field label="Repetisi">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </Field>
            <Field label="Beban (kg)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </Field>
          </div>
          <ErrorState message={formError} />
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan latihan"}
          </Button>
          <p className="meta">
            Isian tetap tersedia jika sesi ditutup atau penyimpanan gagal.
          </p>
        </Form>
      </Modal>
    </>
  );
}
