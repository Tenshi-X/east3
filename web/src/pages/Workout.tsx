import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dayAdd, localDay } from "../../../shared/life";
import {
  formatDuration,
  formatPace,
  weekStart,
  ROUTINES,
  sessionSeconds,
  type WorkoutDay,
} from "../../../shared/workout";
import { api } from "../api";
import { EXERCISES, type ExerciseGuide } from "../exercises";
import { useLocalDay } from "../useLocalDay";
import { useWorkoutSession } from "../useWorkoutSession";
import {
  Button,
  Field,
  Form,
  IconButton,
  ErrorState,
  LoadingState,
  Modal,
  Segments,
  changed,
  messageOf,
  useFeedback,
  usePageLoad,
} from "../ui";
import WorkoutPrograms from "./WorkoutPrograms";

const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) => new Date(`${date}T12:00:00`).toLocaleDateString("id-ID", options);
const activityLabel = (activity: string) =>
  activity === "jogging"
    ? "Jogging"
    : activity === "rest"
      ? "Istirahat"
      : "Workout";
const SHIFTS: Record<string, string> = {
  "1": "Shift pagi",
  "2": "Shift sore",
  "3": "Shift malam",
  "1&2": "Shift pagi–sore",
  "2&3": "Shift sore–malam",
  L: "Libur",
};

function Guide({ exercise }: { exercise: ExerciseGuide }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="life-stack">
      <p className="muted">
        {exercise.target} · {exercise.prescription}
      </p>
      <div className="exercise-images">
        {exercise.images.map((src, i) => (
          <figure key={src}>
            <img
              src={src}
              alt={`${exercise.name}, ${exercise.images.length === 1 ? "posisi gerakan" : i === 0 ? "posisi awal" : "posisi akhir"}`}
              width="480"
              height="360"
              loading="lazy"
              onError={() => setFailed(true)}
            />
            <figcaption>
              {exercise.images.length === 1
                ? "Posisi gerakan"
                : i === 0
                  ? "Posisi awal"
                  : "Posisi akhir"}
            </figcaption>
          </figure>
        ))}
      </div>
      {failed && (
        <p role="status">
          Gambar belum dapat dimuat. Langkah gerakan tetap tersedia di bawah.
        </p>
      )}
      <p className="meta">{exercise.illustration}</p>
      <p>
        <strong>Alat:</strong> {exercise.equipment}
      </p>
      <ol className="exercise-steps">
        {exercise.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p>
        <strong>Versi ringan:</strong> {exercise.easier}
      </p>
      <p>
        <strong>Perhatikan:</strong> {exercise.caution}
      </p>
      <p className="meta">
        Ilustrasi: Everkinetic / Greg Priday.{" "}
        <a href={exercise.source} target="_blank" rel="noreferrer">
          Sumber gambar
        </a>{" "}
        ·{" "}
        <a href={exercise.license} target="_blank" rel="noreferrer">
          {exercise.license.includes("3.0") ? "CC BY-SA 3.0" : "CC BY-SA 4.0"}
        </a>
        . Gambar tidak diubah.
      </p>
    </div>
  );
}

export default function Workout() {
  const feedback = useFeedback(),
    nav = useNavigate(),
    deviceDay = useLocalDay();
  const [week, setWeek] = useState(() => weekStart(localDay()));
  const [tab, setTab] = useState<"week" | "guide" | "report" | "program">(
    "week",
  );
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const result = await api.workoutWeek(week);
      if (seq !== sequence.current) return;
      setData(result);
      setError("");
    } catch (e) {
      if (seq === sequence.current) setError(messageOf(e));
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, [week]);
  usePageLoad("/workout", load);
  const today = localDay(
    new Date(`${deviceDay}T12:00:00`),
    data?.timezone || "Asia/Jakarta",
  );
  const currentWeek = weekStart(today);
  const lastCurrentWeek = useRef(currentWeek);
  useEffect(() => {
    if (lastCurrentWeek.current === currentWeek) return;
    const previousWeek = lastCurrentWeek.current;
    setWeek((selected) => (selected === previousWeek ? currentWeek : selected));
    lastCurrentWeek.current = currentWeek;
  }, [currentWeek]);
  const timer = useWorkoutSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({top:0}); },[tab]);
  useEffect(() => { if(timer.draft?.id) timerRef.current?.scrollIntoView({block:"start"}); },[timer.draft?.id]);
  const [guide, setGuide] = useState<ExerciseGuide | null>(null);
  const [routine, setRoutine] = useState("a");
  const [restUntil, setRestUntil] = useState<number | null>(null),
    [restSeconds, setRestSeconds] = useState(0);
  useEffect(() => {
    if (restUntil === null) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
      setRestSeconds(s);
      if (!s) setRestUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [restUntil]);
  const [form, setForm] = useState<{
    day: WorkoutDay;
    timed: boolean;
    clientId: string;
  } | null>(null);
  const [duration, setDuration] = useState(""),
    [distance, setDistance] = useState("");
  const [source, setSource] = useState("manual"),
    [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [gps, setGps] = useState(true);
  const [startDay, setStartDay] = useState<WorkoutDay | null>(null);
  const dayToday: WorkoutDay | undefined = data?.days.find(
    (d: WorkoutDay) => d.date === today,
  );
  const openManual = (day: WorkoutDay) => {
    setForm({ day, timed: false, clientId: crypto.randomUUID() });
    setDuration("");
    setDistance("");
    setSource("manual");
    setNotes(day.title);
    setFormError("");
  };
  const openTimed = () => {
    if (!timer.draft) return;
    timer.pause();
    const d = timer.draft;
    setForm({
      day: {
        date: d.date,
        activity: d.activity,
        title: d.title,
        template: d.template,
      } as WorkoutDay,
      timed: true,
      clientId: d.id,
    });
    setDistance(d.meters ? (d.meters / 1000).toFixed(3) : "");
    setSource(d.gps && d.meters > 0 ? "gps" : "manual");
    setNotes(d.title);
    setFormError("");
  };
  const save = async () => {
    if (!form || busy) return;
    const seconds = form.timed
      ? timer.seconds
      : Math.round(Number(duration) * 60);
    const meters =
      form.day.activity === "jogging" ? Number(distance || 0) * 1000 : 0;
    if (
      !Number.isFinite(seconds) ||
      seconds < 1 ||
      seconds > 86400 ||
      !Number.isFinite(meters) ||
      meters < 0 ||
      meters > 200000
    ) {
      setFormError(
        "Isi durasi lebih dari 0 (maksimal 1.440 menit) dan jarak 0–200 km.",
      );
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api.workoutSession({
        client_id: form.clientId,
        date: form.day.date,
        activity_type: form.day.activity,
        duration_seconds: seconds,
        distance_meters: Math.round(meters),
        distance_source: meters > 0 ? source : "none",
        started_at: form.timed ? timer.draft?.startedAt : null,
        ended_at: form.timed ? new Date().toISOString() : null,
        notes,
        template_id: form.day.template || null,
        exercise_progress: form.timed ? timer.draft?.progress || [] : [],
      });
      if (form.timed) {
        timer.clear();
        setRestUntil(null);
      }
      setForm(null);
      changed();
      feedback.notify(
        "Sesi tersimpan. Checklist dan laporan sudah diperbarui.",
      );
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const check = async (day: WorkoutDay) => {
    if (day.activity !== "rest") {
      if (day.completed) {
        setTab("report");
        feedback.notify(
          "Untuk mengoreksi checklist, hapus catatan sesi dari laporan.",
        );
      } else openManual(day);
      return;
    }
    setBusy(true);
    const before = data;
    setData(
      (current: any) =>
        current && {
          ...current,
          days: current.days.map((d: WorkoutDay) =>
            d.date === day.date ? { ...d, completed: !day.completed } : d,
          ),
          report: {
            ...current.report,
            completed_days:
              current.report.completed_days + (day.completed ? -1 : 1),
          },
        },
    );
    try {
      await api.workoutCheckin(day.date, !day.completed);
      changed();
    } catch (e) {
      setData(before);
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row: any) => {
    if (
      busy ||
      !(await feedback.confirm(
        "Hapus catatan sesi ini? Durasi dan jaraknya akan dikeluarkan dari laporan.",
      ))
    )
      return;
    setBusy(true);
    try {
      await api.remove("workout_logs", row.id);
      changed();
      feedback.notify("Catatan sesi dihapus");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const navigateWeek = (offset: number) => {
    setLoading(true);
    setData(null);
    setWeek((w) => dayAdd(w, offset));
  };
  const startSession = (day: WorkoutDay) => {
    setGps(day.activity === "jogging");
    setStartDay(day);
  };
  return (
    <>
      <div className="workout-tabs">
        <Segments
          label="Bagian latihan"
          value={tab}
          onChange={setTab}
          options={[
            { value: "week", label: "Mingguan" },
            { value: "guide", label: "Gerakan" },
            { value: "report", label: "Laporan" },
            { value: "program", label: "Program" },
          ]}
        />
      </div>
      {tab === "program" && timer.draft && (
        <div className="workout-tabs">
          <Button variant="tonal" onClick={() => setTab("week")}>
            Sesi aktif · {formatDuration(timer.seconds)}
          </Button>
        </div>
      )}
      {tab === "program" ? (
        <WorkoutPrograms />
      ) : (
          <div className="screen-scroll" ref={scrollRef}>
          <div className="content-width stack workout-page">
            {timer.draft && (
              <section className="card workout-timer" aria-label="Sesi aktif" ref={timerRef}>
                <div className="workout-heading">
                  <div>
                    <p className="meta">
                      {dateLabel(timer.draft.date)} ·{" "}
                      {timer.draft.runningSince === null
                        ? "Dijeda"
                        : "Berlangsung"}
                    </p>
                    <h2>{timer.draft.title}</h2>
                  </div>
                  <span
                    className="session-dot"
                    data-running={timer.draft.runningSince !== null}
                    aria-hidden="true"
                  />
                </div>
                <div
                  className="timer-clock"
                  role="timer"
                  aria-label="Durasi sesi"
                >
                  {formatDuration(timer.seconds)}
                </div>
                {timer.draft.activity === "jogging" && (
                  <>
                    <div className="workout-metrics">
                      <div>
                        <strong>
                          {(timer.draft.meters / 1000).toFixed(2)} km
                        </strong>
                        <span>Jarak GPS</span>
                      </div>
                      <div>
                        <strong>
                          {formatPace(
                            timer.draft.meters >= 50
                              ? timer.seconds / (timer.draft.meters / 1000)
                              : null,
                          )}
                        </strong>
                        <span>Pace rata-rata</span>
                      </div>
                    </div>
                    <p className="meta" role="status">
                      {timer.draft.gps
                        ? timer.gpsMessage
                        : "Timer tanpa GPS. Isi jarak manual saat menyimpan."}
                    </p>
                    <p className="meta">
                      GPS aktif selama layar aplikasi terbuka. Jogging otomatis
                      dijeda saat layar terkunci atau aplikasi masuk latar
                      belakang.
                    </p>
                  </>
                )}
                {timer.draft.interrupted && (
                  <p className="life-notice" role="status">
                    Sesi dijeda setelah aplikasi ditutup atau masuk latar
                    belakang. Tekan Lanjutkan saat siap; periksa jarak sebelum
                    menyimpan.
                  </p>
                )}
                <ErrorState message={timer.storageError} />
                <div className="life-actions">
                  {timer.draft.runningSince === null ? (
                    <Button onClick={timer.resume}>Lanjutkan</Button>
                  ) : (
                    <Button onClick={timer.pause}>Jeda</Button>
                  )}
                  <Button variant="tonal" onClick={openTimed}>
                    Selesai & simpan
                  </Button>
                  <Button
                    variant="text"
                    onClick={async () => {
                      if (
                        await feedback.confirm(
                          "Buang sesi yang belum disimpan ini?",
                        )
                      ) {
                        timer.clear();
                        setRestUntil(null);
                      }
                    }}
                  >
                    Buang sesi
                  </Button>
                </div>
                {timer.draft.activity === "workout" && (
                  <>
                    <div className="workout-rest">
                      <span role="status">
                        {restUntil
                          ? `Istirahat ${restSeconds} detik`
                          : "Jeda antar set 60–90 detik"}
                      </span>
                      <Button
                        variant="tonal"
                        onClick={() =>
                          setRestUntil(restUntil ? null : Date.now() + 60000)
                        }
                      >
                        {restUntil ? "Hentikan jeda" : "Timer istirahat 60 dtk"}
                      </Button>
                      {restUntil && (
                        <Button
                          variant="text"
                          onClick={() =>
                            setRestUntil((t) => (t || Date.now()) + 30000)
                          }
                        >
                          Tambah 30 dtk
                        </Button>
                      )}
                    </div>
                    <div className="session-exercises">
                      {timer.draft.progress.map((p, i) => {
                        const e = EXERCISES.find((e) => e.id === p.id)!;
                        return (
                          <section key={p.id}>
                            <div className="workout-heading">
                              <div>
                                <h3>{e.name}</h3>
                                <p className="meta">{e.prescription}</p>
                              </div>
                              <Button
                                variant="text"
                                onClick={() => setGuide(e)}
                              >
                                Cara gerakan
                              </Button>
                            </div>
                            <Field
                              label={`${e.unit === "seconds" ? "Detik" : "Repetisi"} per set: ${e.name}`}
                            >
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={p.reps}
                                onChange={(event) => {
                                  const reps = Number(event.target.value);
                                  timer.setDraft(
                                    (d) =>
                                      d && {
                                        ...d,
                                        progress: d.progress.map((row, n) =>
                                          n === i ? { ...row, reps } : row,
                                        ),
                                      },
                                  );
                                }}
                              />
                            </Field>
                            <div className="exercise-sets">
                              {p.sets.map((done, s) => (
                                <label key={s}>
                                  <input
                                    type="checkbox"
                                    checked={done}
                                    onChange={() =>
                                      timer.setDraft(
                                        (d) =>
                                          d && {
                                            ...d,
                                            progress: d.progress.map(
                                              (row, n) =>
                                                n === i
                                                  ? {
                                                      ...row,
                                                      sets: row.sets.map(
                                                        (v, k) =>
                                                          k === s ? !v : v,
                                                      ),
                                                    }
                                                  : row,
                                            ),
                                          },
                                      )
                                    }
                                  />
                                  Set {s + 1}
                                </label>
                              ))}
                              <Button
                                variant="text"
                                disabled={p.sets.length >= 3}
                                onClick={() =>
                                  timer.setDraft(
                                    (d) =>
                                      d && {
                                        ...d,
                                        progress: d.progress.map((row, n) =>
                                          n === i
                                            ? {
                                                ...row,
                                                sets: [...row.sets, false],
                                              }
                                            : row,
                                        ),
                                      },
                                  )
                                }
                              >
                                Tambah set
                              </Button>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            )}
            {tab !== "guide" && (
              <div className="workout-week-nav">
                <IconButton
                  icon="chevron_left"
                  label="Minggu sebelumnya"
                  onClick={() => navigateWeek(-7)}
                />
                <div>
                  <strong>
                    {dateLabel(week)} –{" "}
                    {dateLabel(dayAdd(week, 6), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                  <Button
                    variant="text"
                    disabled={week === weekStart(today)}
                    onClick={() => {
                      setData(null);
                      setLoading(true);
                      setWeek(weekStart(today));
                    }}
                  >
                    Minggu ini
                  </Button>
                </div>
                <IconButton
                  icon="chevron_right"
                  label="Minggu berikutnya"
                  onClick={() => navigateWeek(7)}
                />
              </div>
            )}
            {tab !== "guide" && (
              <ErrorState message={error} onRetry={() => void load()} />
            )}
            {tab !== "guide" && loading && <LoadingState />}
            {tab === "week" && data && (
              <>
                <section className="card workout-intro">
                  <h2>Bangun kekuatan, jaga ritme.</h2>
                  <p className="muted">
                    Pola awal: 3 workout seluruh tubuh dan 2 jogging santai.
                    Shift panjang, selesai shift malam, tidur & energi
                    menentukan hari pemulihan.
                  </p>
                  <div className="workout-progress">
                    <progress
                      max="7"
                      value={data.report.completed_days}
                      aria-label="Checklist tujuh hari"
                    />
                    <strong>{data.report.completed_days}/7 hari</strong>
                  </div>
                  <p className="meta">
                    Hari istirahat juga boleh dicentang setelah dijalani. Minggu
                    berganti otomatis; riwayat tetap tersimpan.
                  </p>
                  {data.missing_shifts.length > 0 && (
                    <p className="life-notice">
                      {data.missing_shifts.length} hari belum memiliki data
                      shift. Jadwal hari itu memakai waktu tidur profil.
                      <Button variant="text" onClick={() => nav("/shifts")}>
                        Lengkapi shift
                      </Button>
                    </p>
                  )}
                </section>
                <div className="workout-week-list">
                  {data.days.map((day: WorkoutDay) => (
                    <section
                      key={day.date}
                      className={`card workout-day ${day.date === today ? "is-today" : ""}`}
                    >
                      <div className="workout-heading">
                        <div>
                          <p className="meta">
                            {dateLabel(day.date, {
                              weekday: "long",
                              day: "numeric",
                              month: "short",
                            })}
                            {day.date === today ? " · Hari ini" : ""}
                          </p>
                          <h3>{day.title}</h3>
                        </div>
                        <label className="workout-check">
                          <input
                            type="checkbox"
                            aria-label={`Selesai ${day.date}`}
                            checked={day.completed}
                            disabled={busy || day.date > today}
                            onChange={() => void check(day)}
                          />
                          <span>{day.completed ? "Selesai" : "Checklist"}</span>
                        </label>
                      </div>
                      <p className="meta">
                        {day.shift ? SHIFTS[day.shift] : "Shift belum diisi"}
                        {day.start_time
                          ? ` · ${new Date(day.start_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: data.timezone })} · ${day.minutes} menit`
                          : ""}
                      </p>
                      <p className="muted">{day.reason}</p>
                      {day.activity !== "rest" && (
                        <div className="life-actions">
                          {day.date === today && !day.completed && (
                            <Button
                              disabled={!!timer.draft}
                              onClick={() => startSession(day)}
                            >
                              Mulai {activityLabel(day.activity).toLowerCase()}
                            </Button>
                          )}
                          {!day.completed && day.date <= today && (
                            <Button
                              variant="tonal"
                              disabled={busy}
                              onClick={() => openManual(day)}
                            >
                              Catat manual
                            </Button>
                          )}
                          {day.activity === "workout" && (
                            <Button
                              variant="text"
                              onClick={() => {
                                setRoutine(day.template || "a");
                                setTab("guide");
                              }}
                            >
                              Lihat gerakan {day.template.toUpperCase()}
                            </Button>
                          )}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
                {!timer.draft && dayToday && (
                  <section className="card life-stack">
                    <h3>Latihan di luar rekomendasi</h3>
                    <p className="muted">
                      Pilih sesi lain sesuai kondisi tubuh. Hari pemulihan tetap
                      disarankan bila kamu lelah.
                    </p>
                    <div className="life-actions">
                      <Button
                        variant="tonal"
                        onClick={() =>
                          startSession({
                            ...dayToday,
                            activity: "workout",
                            template: "a",
                            title: "Full body A",
                          })
                        }
                      >
                        Timer workout
                      </Button>
                      <Button
                        variant="tonal"
                        onClick={() =>
                          startSession({
                            ...dayToday,
                            activity: "jogging",
                            template: "",
                            title: "Jogging santai",
                          })
                        }
                      >
                        Timer jogging
                      </Button>
                    </div>
                  </section>
                )}
              </>
            )}
            {tab === "guide" && (
              <>
                <section className="card life-stack">
                  <h2>Latihan kekuatan di kos</h2>
                  <p className="muted">
                    Pemanasan 5 menit. Mulai 2 set per gerakan selama 1–2
                    minggu; tambah ke 3 set setelah nyaman. Sisakan 2–3 repetisi
                    sebelum benar-benar lelah, lalu istirahat 60–90 detik antar
                    set.
                  </p>
                  <p className="meta">
                    Fokus membangun otot. Jaga makan cukup dan tidur; jogging
                    cukup santai. Hentikan gerakan yang menimbulkan nyeri.
                  </p>
                  <p className="meta">
                    <a
                      href="https://www.nhs.uk/live-well/exercise/strength-exercises/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Referensi latihan kekuatan di rumah (NHS)
                    </a>
                  </p>
                </section>
                <Segments
                  label="Pilihan sesi latihan"
                  value={routine}
                  onChange={setRoutine}
                  options={ROUTINES.map((r) => ({
                    value: r.id,
                    label: r.name,
                  }))}
                />
                {ROUTINES.filter((r) => r.id === routine).map((r) => (
                  <section className="card life-stack" key={r.id}>
                    <h2>{r.name}</h2>
                    <div className="exercise-guide-list">
                      {r.exercises.map((id) => {
                        const e = EXERCISES.find((e) => e.id === id)!;
                        return (
                          <button
                            type="button"
                            key={id}
                            onClick={() => setGuide(e)}
                          >
                            <img
                              src={e.images[0]}
                              alt=""
                              width="80"
                              height="70"
                              loading="lazy"
                            />
                            <span>
                              <strong>{e.name}</strong>
                              <small>{e.prescription}</small>
                              <small>{e.target}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            )}
            {tab === "report" && data && (
              <>
                <section className="card life-stack">
                  <h2>Laporan latihan mingguan</h2>
                  <div className="workout-metrics report-metrics">
                    <div>
                      <strong>{data.report.strength}</strong>
                      <span>Sesi kekuatan</span>
                    </div>
                    <div>
                      <strong>{data.report.jogging}</strong>
                      <span>Sesi jogging</span>
                    </div>
                    <div>
                      <strong>
                        {Math.round(data.report.duration_seconds / 60)} mnt
                      </strong>
                      <span>Total durasi</span>
                    </div>
                    <div>
                      <strong>
                        {(data.report.distance_meters / 1000).toFixed(2)} km
                      </strong>
                      <span>Jarak jogging</span>
                    </div>
                    <div>
                      <strong>{formatPace(data.report.pace_seconds)}</strong>
                      <span>Pace rata-rata</span>
                    </div>
                    <div>
                      <strong>{data.report.sets}</strong>
                      <span>Set dicentang</span>
                    </div>
                  </div>
                  <p>
                    {data.report.completed_active}/{data.report.planned_active}{" "}
                    hari latihan selesai · {data.report.active_days} hari aktif.
                  </p>
                  <p className="muted">
                    Minggu sebelumnya: {data.previous.sessions} sesi,{" "}
                    {Math.round(data.previous.duration_seconds / 60)} menit,{" "}
                    {(data.previous.distance_meters / 1000).toFixed(2)} km.
                  </p>
                  <p className="meta">
                    Pace dihitung dari total durasi dibagi total jarak sesi
                    jogging yang memiliki jarak. Hari istirahat tidak dihitung
                    sebagai sesi latihan. Jarak manual mengikuti isianmu.
                  </p>
                  {!data.report.sessions && (
                    <p role="status">
                      Belum ada sesi minggu ini. Mulai timer atau catat latihan
                      yang sudah dilakukan.
                    </p>
                  )}
                </section>
                <section className="life-stack">
                  <h2>Catatan sesi</h2>
                  {data.sessions
                    .filter(
                      (s: any) => s.date >= week && s.date < dayAdd(week, 7),
                    )
                    .map((s: any) => (
                      <article className="card" key={s.id}>
                        <div className="workout-heading">
                          <div>
                            <p className="meta">
                              {dateLabel(s.date, {
                                weekday: "long",
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                            <h3>{s.notes || activityLabel(s.activity_type)}</h3>
                          </div>
                          <IconButton
                            icon="delete"
                            label={`Hapus sesi ${s.notes || s.date}`}
                            disabled={busy}
                            onClick={() => void remove(s)}
                          />
                        </div>
                        <p>
                          {formatDuration(sessionSeconds(s))}
                          {s.activity_type === "jogging"
                            ? ` · ${(Number(s.distance_meters || 0) / 1000).toFixed(2)} km · ${formatPace(Number(s.distance_meters) > 0 ? sessionSeconds(s) / (Number(s.distance_meters) / 1000) : null)}`
                            : ""}
                        </p>
                        <p className="meta">
                          {s.distance_source === "gps"
                            ? "Jarak dari GPS"
                            : s.distance_source === "manual"
                              ? "Jarak diisi manual"
                              : "Tanpa jarak"}
                          {s.duration_seconds == null ? " · Catatan lama" : ""}
                        </p>
                        {(s.exercise_progress || []).map((p: any) => (
                          <p className="meta" key={p.id}>
                            {EXERCISES.find((e) => e.id === p.id)?.name || p.id}
                            : {p.sets.filter(Boolean).length} set × {p.reps}{" "}
                            {p.unit === "seconds" ? "detik" : "repetisi"}
                          </p>
                        ))}
                      </article>
                    ))}
                </section>
              </>
            )}
          </div>
        </div>
      )}
      <Modal
        full
        open={!!guide}
        title={guide?.name || "Panduan gerakan"}
        onClose={() => setGuide(null)}
      >
        {guide && <Guide key={guide.id} exercise={guide} />}
      </Modal>
      <Modal
        open={!!startDay}
        title="Mulai sesi latihan"
        onClose={() => setStartDay(null)}
      >
        <div className="life-stack">
          <h3>{startDay?.title}</h3>
          {startDay?.activity === "jogging" ? (
            <>
              <label className="workout-option">
                <input
                  type="checkbox"
                  checked={gps}
                  onChange={(e) => setGps(e.target.checked)}
                />
                Hitung jarak & pace dengan GPS
              </label>
              <p className="muted">
                Izinkan lokasi saat diminta. Tidak menggunakan peta atau Google
                Maps. Koordinat hanya dipakai untuk menghitung jarak dan tidak
                disimpan.
              </p>
              <p className="meta">
                Biarkan aplikasi terbuka. Jogging akan dijeda saat layar
                terkunci atau aplikasi masuk latar belakang.
              </p>
            </>
          ) : (
            <p className="muted">
              Mulai dengan pemanasan 5 menit. Timer mencatat total sesi termasuk
              jeda antar set.
            </p>
          )}
          <Button
            disabled={!!timer.draft}
            onClick={() => {
              if (startDay) {
                timer.start(startDay, gps);
                setStartDay(null);
              }
            }}
          >
            Mulai timer
          </Button>
        </div>
      </Modal>
      <Modal
        full
        open={!!form}
        title="Simpan sesi latihan"
        onClose={() => setForm(null)}
        busy={busy}
      >
        <Form onSubmit={save}>
          <p>
            {form?.day.title} · {form && dateLabel(form.day.date)}
          </p>
          {form?.timed ? (
            <p>
              Durasi aktif: <strong>{formatDuration(timer.seconds)}</strong>
            </p>
          ) : (
            <Field label="Durasi aktual (menit)">
              <input
                autoFocus
                required
                type="number"
                min="0.02"
                max="1440"
                step="0.01"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
          )}
          {form?.day.activity === "jogging" && (
            <>
              <Field label="Jarak (km, opsional)">
                <input
                  type="number"
                  min="0"
                  max="200"
                  step="0.001"
                  value={distance}
                  onChange={(e) => {
                    setDistance(e.target.value);
                    setSource("manual");
                  }}
                />
              </Field>
              <p className="meta">
                {source === "gps"
                  ? "Jarak terukur GPS. Mengubah isian akan menandainya sebagai jarak manual."
                  : "Isi jarak jika diketahui. Tanpa jarak, pace tidak dihitung."}
              </p>
            </>
          )}
          <Field label="Catatan sesi">
            <textarea
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <ErrorState message={formError} />
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan sesi"}
          </Button>
          <p className="meta">
            Jika penyimpanan gagal, sesi tetap tersedia untuk dicoba lagi.
          </p>
        </Form>
      </Modal>
    </>
  );
}
