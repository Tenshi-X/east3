import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import {
  Button,
  changed,
  ErrorState,
  LoadingState,
  messageOf,
  usePageLoad,
} from "./ui";
import { clockInZone, localDay, SHIFT_TYPES } from "../../shared/life";
import { useLocalDay } from "./useLocalDay";
import CardCarousel from "./CardCarousel";

export function useLife(path: string, date?: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const day = useLocalDay();
  const load = useCallback(async () => {
    try {
      const result = await api.life("get", date ? { date } : {});
      if (!result?.plan) throw new Error("Rencana belum dapat dimuat.");
      setData(result);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [date, day]);
  usePageLoad(path, load);
  return { data, error, loading, load };
}
export function PlanList({
  data,
  compact = false,
}: {
  data: any;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [last, setLast] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const act = async (item: any, status: string) => {
    if (busy) return;
    setBusy(item.key);
    setError("");
    try {
      const r = await api.life("plan_state", {
        date: data.date,
        key: item.key,
        status,
      });
      setLast(r);
      changed();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy("");
    }
  };
  const items = compact
    ? data.plan.items
        .filter(
          (i: any) =>
            !["done", "skipped"].includes(i.status) &&
            Date.parse(i.end_time) > now,
        )
        .slice(0, 1)
    : data.plan.items;
  const time = (v: string) =>
    `${clockInZone(v, data.timezone)}${localDay(v, data.timezone) > data.date ? " besok" : localDay(v, data.timezone) < data.date ? " kemarin" : ""}`;
  return (
    <div className="life-stack">
      <ErrorState message={error} />
      {last && (
        <div className="life-notice" role="status">
          {last.message}
          {last.can_undo && (
            <Button
              variant="text"
              disabled={!!busy}
              onClick={async () => {
                setBusy("undo");
                try {
                  await api.life("undo_life_action", {
                    action_id: last.action_id,
                  });
                  setLast(null);
                  changed();
                } catch (e) {
                  setError(messageOf(e));
                } finally {
                  setBusy("");
                }
              }}
            >
              Batalkan
            </Button>
          )}
        </div>
      )}
      {!items.length && (
        <p className="muted">
          Tidak ada aktivitas berikutnya. Catatanmu tetap tersedia di Kesehatan.
        </p>
      )}
      {items.map((item: any) => (
        <article
          className={`plan-item ${["done", "skipped"].includes(item.status) ? "plan-finished" : ""}`}
          key={item.key}
        >
          <div className="row">
            <span className={`plan-kind kind-${item.kind}`} aria-hidden="true">
              {
                (
                  {
                    meal: "◒",
                    sleep: "☾",
                    workout: "↗",
                    task: "✓",
                    recovery: "☾",
                  } as any
                )[item.kind]
              }
            </span>
            <div className="grow">
              <strong>{item.title}</strong>
              <p className="meta">
                {time(item.start_time)}–{time(item.end_time)}
                {item.flexible ? " · sesuaikan jeda" : ""}
              </p>
            </div>
          </div>
          {!compact && item.note && <p className="meta">{item.note}</p>}
          {!compact && item.exercises && (
            <details>
              <summary>Gerakan & panduan latihan</summary>
              <p className="meta">
                Beban ringan atau berat badan sendiri. Istirahat 60–90 detik
                antarket.
              </p>
              <ul>
                {item.exercises.map((e: any) => (
                  <li key={e.name}>
                    {e.name} · {e.defaultSets} × {e.defaultReps} repetisi
                  </li>
                ))}
              </ul>
            </details>
          )}
          {item.kind !== "sleep" &&
            !["done", "skipped"].includes(item.status) && (
              <div className="life-actions">
                <Button
                  variant="tonal"
                  disabled={!!busy}
                  onClick={() => void act(item, "done")}
                >
                  {item.kind === "meal"
                    ? "Sudah makan"
                    : item.kind === "workout"
                      ? "Sudah latihan"
                      : "Selesai"}
                </Button>
                <Button
                  variant="text"
                  disabled={!!busy}
                  onClick={() => void act(item, "snoozed")}
                >
                  Tunda 30 mnt
                </Button>
                {!compact && (
                  <Button
                    variant="text"
                    disabled={!!busy}
                    onClick={() => void act(item, "skipped")}
                  >
                    Lewati
                  </Button>
                )}
              </div>
            )}
          {["done", "skipped"].includes(item.status) && (
            <small>
              {item.status === "done" ? "✓ Selesai dicatat" : "Dilewati"}
            </small>
          )}
        </article>
      ))}
    </div>
  );
}
export default function LifePanel({ full = false }: { full?: boolean }) {
  const nav = useNavigate();
  const { data, error, loading, load } = useLife(full ? "/plan" : "/");
  if (loading) return <LoadingState />;
  if (error)
    return (
      <div className="card">
        <ErrorState message={error} onRetry={() => void load()} />
        <Button variant="text" onClick={() => nav("/health")}>
          Buka kesehatan & shift
        </Button>
      </div>
    );
  if (!data) return null;
  const activeShift = data.shifts.find(
    (s: any) =>
      s.start_time &&
      Date.parse(s.start_time) <= Date.now() &&
      Date.parse(s.end_time) > Date.now(),
  );
  const todayShift = data.shifts.find((s: any) => s.date === data.date);
  const hero = (
    <div className="card life-hero">
      <p className="eyebrow">SEKARANG & BERIKUTNYA</p>
      <h2>
        {activeShift
          ? `Sedang shift ${SHIFT_TYPES[activeShift.code]?.label.toLowerCase()}`
          : todayShift
            ? todayShift.code === "L"
              ? "Hari libur, beri ruang untuk diri sendiri"
              : `Hari ini shift ${SHIFT_TYPES[todayShift.code]?.label.toLowerCase()}`
            : "Mulai dari ritmemu hari ini"}
      </h2>
      {todayShift?.start_time && (
        <p>
          {clockInZone(todayShift.start_time, data.timezone)}–
          {clockInZone(todayShift.end_time, data.timezone)}
          {localDay(todayShift.end_time, data.timezone) > data.date
            ? " besok"
            : ""}
        </p>
      )}
      {!data.has_profile && (
        <p className="meta">
          Atur profil sekali lewat chat atau Kesehatan agar rencana sesuai
          kebiasaanmu.
        </p>
      )}
      {full &&
        data.plan.reasons.map((r: string) => (
          <p className="meta" key={r}>
            {r}
          </p>
        ))}
      <div className="life-stats">
        <div>
          <strong>
            {data.progress.meals}/{data.profile.meals_target}
          </strong>
          <span>makan tercatat</span>
        </div>
        <div>
          <strong>
            {data.progress.weight_kg ?? "—"} <small>kg</small>
          </strong>
          <span>berat terakhir</span>
        </div>
        <div>
          <strong>
            {data.progress.workouts_week}/{data.profile.workout_weekly}
          </strong>
          <span>latihan / 7 hari</span>
        </div>
      </div>
      <div className="life-actions">
        <Button variant="tonal" onClick={() => nav("/health")}>
          Catat kesehatan
        </Button>
        <Button variant="text" onClick={() => nav(full ? "/shifts" : "/plan")}>
          {full ? "Kelola shift" : "Lihat rencana hari ini"}
        </Button>
      </div>
    </div>
  );
  if (!full)
    return (
      <CardCarousel title="Ritme harimu">
        {hero}
        <div className="card">
          <h2 className="next-plan-heading">Aktivitas berikutnya</h2>
          <PlanList data={data} compact />
          <Button variant="text" onClick={() => nav("/plan")}>
            Lihat rencana lengkap
          </Button>
        </div>
      </CardCarousel>
    );
  return (
    <section className="life-stack" aria-label="Rencana sesuai shift">
      {hero}
      <PlanList data={data} compact={!full} />
      {full && (
        <>
          <p className="meta">
            Usulan mengikuti shift, tidur, perjalanan{" "}
            {data.profile.commute_minutes} menit, dan handover{" "}
            {data.profile.handover_minutes} menit setelah shift. Waktu jeda
            makan perlu disesuaikan dengan izin kerja.
          </p>
          <Button
            variant="text"
            onClick={() =>
              nav(
                "/ai?text=" +
                  encodeURIComponent(
                    "Saya sedang capek. Bantu sesuaikan rencana hari ini.",
                  ),
              )
            }
          >
            Sesuaikan lewat chat
          </Button>
        </>
      )}
    </section>
  );
}
