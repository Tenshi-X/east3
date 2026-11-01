import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Button,
  changed,
  ErrorState,
  Field,
  Form,
  LoadingState,
  messageOf,
  Section,
} from "../ui";
import { useLife } from "../LifePanel";
import { ReminderSettings } from "../Reminders";
import { HydrationSettings } from "../HydrationReminders";
import { clockInZone } from "../../../shared/life";

const labels: Record<string, string> = {
  height_cm: "Tinggi (cm)",
  weight_kg: "Berat awal (kg)",
  target_weight_kg: "Target berat (kg)",
  age: "Usia",
  calorie_target: "Target energi (kkal, opsional)",
  protein_target: "Target protein (g, opsional)",
  meals_target: "Kesempatan makan / hari",
  sleep_hours: "Target tidur (jam)",
  commute_minutes: "Perjalanan satu arah (menit)",
  handover_minutes: "Handover setelah shift (menit)",
  workout_weekly: "Latihan / 7 hari",
  workout_minutes: "Durasi latihan (menit)",
};
export function HealthProfile({
  profile,
  open = false,
}: {
  profile: any;
  open?: boolean;
}) {
  const [values, setValues] = useState<any>(profile);
  const [expanded, setExpanded] = useState(open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => setValues(profile), [JSON.stringify(profile)]);
  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const row: any = {};
      for (const key of Object.keys(labels))
        if (values[key] !== undefined)
          row[key] =
            values[key] === "" || values[key] === null
              ? null
              : Number(values[key]);
      for (const key of ["wake_time", "bed_time", "preferences"])
        row[key] = values[key];
      await api.life("update_health_profile", row);
      changed();
      setSaved(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <details
      className="card life-stack"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Profil & kebiasaan pribadi</summary>
      <p className="muted">
        Cukup atur sekali. Kamu juga bisa menceritakannya lewat chat.
      </p>
      <Form onSubmit={save}>
        <div className="life-form-grid">
          {Object.entries(labels).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="number"
                step={
                  [
                    "weight_kg",
                    "target_weight_kg",
                    "height_cm",
                    "sleep_hours",
                    "protein_target",
                  ].includes(key)
                    ? "0.1"
                    : "1"
                }
                value={values[key] ?? ""}
                onChange={(e) =>
                  setValues((v: any) => ({ ...v, [key]: e.target.value }))
                }
              />
            </Field>
          ))}
          <Field label="Biasanya bangun">
            <input
              type="time"
              value={values.wake_time}
              onChange={(e) =>
                setValues((v: any) => ({ ...v, wake_time: e.target.value }))
              }
            />
          </Field>
          <Field label="Biasanya tidur">
            <input
              type="time"
              value={values.bed_time}
              onChange={(e) =>
                setValues((v: any) => ({ ...v, bed_time: e.target.value }))
              }
            />
          </Field>
        </div>
        <Field label="Preferensi makanan, alat latihan, dan kebutuhan lain">
          <textarea
            rows={3}
            maxLength={4000}
            value={values.preferences || ""}
            onChange={(e) =>
              setValues((v: any) => ({ ...v, preferences: e.target.value }))
            }
            placeholder="Mis. latihan di rumah, suka tempe, tidak cocok susu…"
          />
        </Field>
        <p className="meta">
          Target energi dan protein boleh kosong. Jumlah makan membantu
          membangun kebiasaan; kecukupan gizi perlu dilihat dari porsi dan
          kebutuhan pribadi.
        </p>
        <ErrorState message={error} />
        {saved && <p role="status">Profil tersimpan.</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan profil"}
        </Button>
      </Form>
    </details>
  );
}
export default function Health({ userId }: { userId: string }) {
  const nav = useNavigate();
  const { data, loading, error, load } = useLife("/health");
  const [kind, setKind] = useState("meal");
  const [description, setDescription] = useState("");
  const [number, setNumber] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [last, setLast] = useState<any>(null);
  const save = async () => {
    setBusy(true);
    setFormError("");
    try {
      const params: any = {
        kind,
        description,
        date: editing ? editingDate : data.date,
        ...(editing ? { id: editing } : {}),
      };
      if (kind === "meal") {
        if (calories !== "") params.calories = Number(calories);
        if (protein !== "") params.protein_g = Number(protein);
      } else
        params[
          (
            {
              weight: "weight_kg",
              sleep: "sleep_hours",
              energy: "energy",
            } as any
          )[kind]
        ] = Number(number);
      const result = await api.life("log_wellness", params);
      setLast(result);
      setDescription("");
      setNumber("");
      setCalories("");
      setProtein("");
      setEditing(null);
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="screen-scroll">
        <LoadingState />
      </div>
    );
  if (error || !data)
    return (
      <div className="screen-scroll">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  const weights = data.logs.filter((l: any) => l.kind === "weight");
  const min = Math.min(...weights.map((w: any) => Number(w.weight_kg))),
    max = Math.max(...weights.map((w: any) => Number(w.weight_kg)));
  const points = weights
    .map(
      (w: any, i: number) =>
        `${10 + (i * 280) / Math.max(1, weights.length - 1)},${80 - ((Number(w.weight_kg) - min) * 60) / Math.max(1, max - min)}`,
    )
    .join(" ");
  const meals = data.logs.filter((l: any) => l.kind === "meal");
  const favorites: any[] = [
    ...new Map<string, any>(
      [...meals].reverse().map((m: any) => [m.description, m] as [string, any]),
    ).values(),
  ].slice(0, 3);
  return (
    <div className="screen-scroll">
      <div className="content-width life-stack">
        <div className="card life-hero">
          <p className="eyebrow">LANGKAH KECIL, TERCATAT</p>
          <h2>Makan, bergerak, pulih</h2>
          <div className="life-stats">
            <div>
              <strong>
                {data.progress.meals}/{data.profile.meals_target}
              </strong>
              <span>makan hari ini</span>
            </div>
            <div>
              <strong>{data.progress.weight_kg ?? "—"} kg</strong>
              <span>berat terakhir</span>
            </div>
            <div>
              <strong>{data.progress.sleep_hours ?? "—"} jam</strong>
              <span>tidur tercatat</span>
            </div>
          </div>
          <Button
            variant="tonal"
            onClick={() =>
              nav(
                "/ai?text=" +
                  encodeURIComponent(
                    "Bantu catat makanan, berat badan, dan tidur saya.",
                  ),
              )
            }
          >
            Ceritakan lewat AI
          </Button>
        </div>
        <HealthProfile profile={data.profile} open={!data.has_profile} />
        <HydrationSettings userId={userId} />
        <ReminderSettings enabled={data.profile.reminders_enabled} />
        <section className="card life-stack" aria-label="Pencatatan kesehatan">
          <h2>{editing ? "Koreksi catatan" : "Catat cepat"}</h2>
          <div className="life-actions">
            {[
              ["meal", "Makan"],
              ["weight", "Berat"],
              ["sleep", "Tidur"],
              ["energy", "Energi"],
            ].map(([k, label]) => (
              <Button
                key={k}
                variant={kind === k ? "tonal" : "text"}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  setNumber("");
                  setEditing(null);
                  setDescription("");
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <Form onSubmit={save}>
            {kind === "meal" ? (
              <>
                <Field label="Apa yang dimakan?">
                  <input
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nasi, ayam, tempe…"
                  />
                </Field>
                <details>
                  <summary>Perkiraan gizi (opsional)</summary>
                  <div className="field-pair">
                    <Field label="Kalori (kkal)">
                      <input
                        type="number"
                        min="0"
                        value={calories}
                        onChange={(e) => setCalories(e.target.value)}
                      />
                    </Field>
                    <Field label="Protein (g)">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={protein}
                        onChange={(e) => setProtein(e.target.value)}
                      />
                    </Field>
                  </div>
                </details>
              </>
            ) : (
              <Field
                label={
                  kind === "weight"
                    ? "Berat badan (kg)"
                    : kind === "sleep"
                      ? "Durasi tidur terakhir (jam)"
                      : "Energi (1 sangat lelah – 5 bugar)"
                }
              >
                <input
                  required
                  type="number"
                  step={kind === "energy" ? "1" : "0.1"}
                  min={kind === "weight" ? 20 : kind === "energy" ? 1 : 0}
                  max={kind === "weight" ? 350 : kind === "energy" ? 5 : 24}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </Field>
            )}
            <ErrorState message={formError} />
            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : editing ? "Simpan koreksi" : "Catat"}
            </Button>
            {editing && (
              <Button
                variant="text"
                onClick={() => {
                  setEditing(null);
                  setDescription("");
                }}
              >
                Batal koreksi
              </Button>
            )}
          </Form>
          {last && (
            <div className="life-notice" role="status">
              {last.message}
              <Button
                variant="text"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.life("undo_life_action", {
                      action_id: last.action_id,
                    });
                    setLast(null);
                    changed();
                  } catch (e) {
                    setFormError(messageOf(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Batalkan aksi
              </Button>
            </div>
          )}
          {kind === "meal" && !!favorites.length && (
            <>
              <p className="meta">Makan menu yang sama? Cukup satu ketukan.</p>
              <div className="life-actions">
                {favorites.map((m) => (
                  <Button
                    variant="tonal"
                    key={m.id}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setLast(
                          await api.life("repeat_meal", {
                            id: m.id,
                            date: data.date,
                          }),
                        );
                        changed();
                      } catch (e) {
                        setFormError(messageOf(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {m.description}
                  </Button>
                ))}
              </div>
            </>
          )}
        </section>
        <Section title="Gizi yang tercatat hari ini">
          <div className="card">
            <p>
              <strong>≈ {data.progress.calories} kkal</strong>
              {data.profile.calorie_target
                ? ` / ${data.profile.calorie_target} kkal`
                : ""}{" "}
              · ≈ {data.progress.protein_g} g protein
              {data.profile.protein_target
                ? ` / ${data.profile.protein_target} g`
                : ""}
            </p>
            <p className="meta">
              Perkiraan berdasarkan catatan.{" "}
              {data.progress.unestimated_meals
                ? `${data.progress.unestimated_meals} makanan belum memiliki perkiraan gizi.`
                : "Porsi dan bahan memengaruhi hasil."}
            </p>
          </div>
        </Section>
        <Section title="Perkembangan berat · 30 hari">
          <div className="card">
            {weights.length ? (
              <figure className="weight-chart">
                <svg
                  viewBox="0 0 300 100"
                  role="img"
                  aria-label={`Tren ${weights.length} pengukuran berat; terakhir ${data.progress.weight_kg} kg`}
                >
                  <polyline
                    points={points}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="3"
                  />
                  {points.split(" ").map((p: string, i: number) => (
                    <circle
                      key={i}
                      cx={p.split(",")[0]}
                      cy={p.split(",")[1]}
                      r="4"
                      fill="var(--primary)"
                    >
                      <title>
                        {weights[i].date}: {weights[i].weight_kg} kg
                      </title>
                    </circle>
                  ))}
                </svg>
                <figcaption className="meta">
                  {weights[0].date}–{weights.at(-1).date} ·{" "}
                  {data.progress.weight_change == null
                    ? "Tambahkan pengukuran berikutnya untuk melihat perubahan."
                    : `${Number(data.progress.weight_change).toFixed(1)} kg dari pengukuran pertama dalam periode ini.`}
                </figcaption>
              </figure>
            ) : (
              <p className="muted">
                Catat berat pada kondisi yang serupa untuk melihat tren.
              </p>
            )}
          </div>
        </Section>
        <Section title="Tujuh hari terakhir">
          <div className="life-week">
            {data.weekly.map((d: any) => (
              <div key={d.date}>
                <small>{d.date.slice(8)}</small>
                <strong>{d.meals}×</strong>
                <span>{d.workout ? "Latihan ✓" : "Makan"}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Riwayat & koreksi">
          <div className="list">
            {[...data.logs]
              .reverse()
              .slice(0, 20)
              .map((l: any) => (
                <div className="list-row" key={l.id}>
                  <div className="copy">
                    <strong>
                      {l.kind === "meal"
                        ? l.description
                        : l.kind === "weight"
                          ? `${l.weight_kg} kg`
                          : l.kind === "sleep"
                            ? `Tidur ${l.sleep_hours} jam`
                            : `Energi ${l.energy}/5`}
                    </strong>
                    <p>
                      {l.date} · {clockInZone(l.logged_at, data.timezone)}
                      {l.kind === "meal" && l.is_estimate
                        ? " · gizi estimasi"
                        : ""}
                    </p>
                  </div>
                  <Button
                    variant="text"
                    onClick={() => {
                      setKind(l.kind);
                      setEditing(l.id);
                      setEditingDate(l.date);
                      setDescription(l.description);
                      setNumber(
                        String(l.weight_kg ?? l.sleep_hours ?? l.energy ?? ""),
                      );
                      setCalories(l.calories == null ? "" : String(l.calories));
                      setProtein(
                        l.protein_g == null ? "" : String(l.protein_g),
                      );
                      document
                        .querySelector('[aria-label="Pencatatan kesehatan"]')
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Ubah
                  </Button>
                </div>
              ))}
            {!data.logs.length && (
              <p className="muted">Belum ada catatan kesehatan.</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
