import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, localDate, todayStr } from "../api";
import HabitProgress from "../HabitProgress";
import { useLocalDay } from "../useLocalDay";
import {
  HABIT_TEMPLATES,
  habitDone,
  habitStep,
  habitTarget,
  waterEstimate,
} from "../habits";
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
  const [template, setTemplate] = useState("custom");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState("kali");
  const [step, setStep] = useState("1");
  const [displayUnit, setDisplayUnit] = useState("glasses");
  const [glassMl, setGlassMl] = useState("250");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    if (!panel.open) {
      setEditing(null);
      setFormError("");
    }
  }, [panel.open]);
  const load = useCallback(async () => {
    try {
      const [h, l] = await Promise.all([
        api.listAll("habits", {
          order_by: "created_at",
          order_dir: "asc",
          filter_eq_is_active: "true",
        }),
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
  const today = useLocalDay();
  const valueOf = (id: string) =>
    Number(
      logs.find((l) => l.habit_id === id && localDate(l.date) === today)
        ?.value || 0,
    );
  const done = (id: string) =>
    habitDone(
      habits.find((h) => h.id === id),
      logs.find((l) => l.habit_id === id && localDate(l.date) === today),
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
      const water = template === "water";
      const glass = Number(glassMl);
      const dailyTarget = water
        ? Number(target) * (displayUnit === "liters" ? 1000 : glass)
        : Number(target);
      const stepValue = water ? glass : Number(step);
      if (
        ![dailyTarget, stepValue].every(
          (n) => Number.isFinite(n) && n >= 0.01 && n <= 99999999.99,
        )
      )
        throw new Error("Target dan jumlah per ketukan harus lebih dari nol.");
      if (water && (glass < 50 || glass > 2000))
        throw new Error("Ukuran gelas harus antara 50 dan 2.000 ml.");
      if (
        water &&
        ((height && (Number(height) < 50 || Number(height) > 250)) ||
          (weight && (Number(weight) < 20 || Number(weight) > 300)))
      )
        throw new Error("Periksa kembali tinggi dan berat badan.");
      const row = {
        name: name.trim(),
        frequency: water ? "daily" : freq,
        color,
        target_value: Math.round(dailyTarget * 100) / 100,
        unit: water ? "ml" : unit.trim() || "kali",
        step_value: stepValue,
        settings: water
          ? {
              template,
              display_unit: displayUnit,
              glass_ml: glass,
              height_cm: height ? Number(height) : null,
              weight_kg: weight ? Number(weight) : null,
            }
          : { template },
      };
      if (editing) await api.update("habits", editing, row);
      else await api.create("habits", row);
      setName("");
      panel.close();
      feedback.notify(
        editing ? "Kebiasaan diperbarui" : "Kebiasaan ditambahkan",
      );
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const applyTemplate = (id: string) => {
    setTemplate(id);
    const preset = HABIT_TEMPLATES.find((t) => t.id === id);
    setName(preset?.name || "");
    setFreq("daily");
    setColor(preset?.color || COLORS[0].value);
    setTarget(String(preset?.target || 1));
    setUnit(preset?.unit || "kali");
    setStep(String(preset?.step || 1));
    setDisplayUnit("glasses");
    setGlassMl("250");
    setHeight("");
    setWeight("");
    setFormError("");
  };
  const openNew = (id = "custom") => {
    setEditing(null);
    applyTemplate(id);
    nav("/habits?new=1");
  };
  const edit = (h: any) => {
    setEditing(h.id);
    setTemplate(h.settings?.template || "custom");
    setName(h.name);
    setFreq(h.frequency || "daily");
    setColor(h.color || COLORS[0].value);
    setUnit(h.unit || "kali");
    setStep(String(habitStep(h)));
    const water = h.settings?.template === "water";
    const display = h.settings?.display_unit || "glasses";
    const glass = Number(h.settings?.glass_ml) || 250;
    setDisplayUnit(display);
    setGlassMl(String(glass));
    setTarget(
      String(
        water
          ? habitTarget(h) / (display === "liters" ? 1000 : glass)
          : habitTarget(h),
      ),
    );
    setHeight(h.settings?.height_cm ? String(h.settings.height_cm) : "");
    setWeight(h.settings?.weight_kg ? String(h.settings.weight_kg) : "");
    setFormError("");
    nav("/habits?new=1");
  };
  const increment = async (h: any, direction: number) => {
    if (pending.includes(h.id)) return;
    setPending((p) => [...p, h.id]);
    try {
      const date = todayStr();
      const result = await api.incrementHabit(
        h.id,
        date,
        Math.round(habitStep(h) * direction * 100) / 100,
      );
      setLogs((current) => [
        ...current.filter(
          (l) => !(l.habit_id === h.id && localDate(l.date) === date),
        ),
        result.data,
      ]);
      changed();
    } catch (e) {
      feedback.notify(messageOf(e));
    } finally {
      setPending((p) => p.filter((id) => id !== h.id));
    }
  };
  const toggle = async (h: any) => {
    if (pending.includes(h.id)) return;
    setPending((p) => [...p, h.id]);
    try {
      const date = todayStr();
      const complete = !habitDone(
        h,
        logs.find((l) => l.habit_id === h.id && localDate(l.date) === date),
      );
      const value = complete ? habitTarget(h) : 0;
      const result = await api.upsert(
        "habit_logs",
        {
          habit_id: h.id,
          date,
          value,
          is_completed: complete,
        },
        "habit_id,date",
      );
      setLogs((current) => [
        ...current.filter(
          (l) => !(l.habit_id === h.id && localDate(l.date) === date),
        ),
        result?.data || { habit_id: h.id, date, value, is_completed: complete },
      ]);
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
          <details className="section template-catalog" open={!habits.length}>
            <summary>Template sehari-hari</summary>
            <p className="meta">
              Pilih titik awal, lalu sesuaikan target dengan rutinitasmu.
            </p>
            <div className="habit-templates">
              {HABIT_TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className="habit-template"
                  onClick={() => openNew(t.id)}
                >
                  <span
                    className="habit-color"
                    style={{ background: t.color }}
                  />
                  <strong>{t.name}</strong>
                  <span className="meta">{t.description}</span>
                </button>
              ))}
            </div>
          </details>
          <div className="section">
            {loading ? (
              <LoadingState />
            ) : habits.length ? (
              <div className="list">
                {habits.map((h) => (
                  <div className="habit-item" key={h.id}>
                    <div className={`list-row ${done(h.id) ? "done" : ""}`}>
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
                        icon="edit_note"
                        label={`Ubah ${h.name}`}
                        disabled={pending.includes(h.id)}
                        onClick={() => edit(h)}
                      />
                      <IconButton
                        icon="delete"
                        label={`Hapus ${h.name}`}
                        disabled={pending.includes(h.id)}
                        onClick={() => void remove(h)}
                      />
                    </div>
                    <HabitProgress
                      habit={h}
                      value={valueOf(h.id)}
                      pending={pending.includes(h.id)}
                      onIncrement={(direction) => void increment(h, direction)}
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
      <Fab label="Kebiasaan baru" onClick={() => openNew()} />
      <Modal
        open={panel.open}
        title={editing ? "Ubah kebiasaan" : "Kebiasaan baru"}
        onClose={panel.close}
        busy={busy}
      >
        <Form onSubmit={save}>
          {!editing && (
            <Field label="Template kebiasaan">
              <select
                value={template}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="custom">Buat sendiri</option>
                {HABIT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Nama kebiasaan">
            <input
              autoFocus
              required
              placeholder="Contoh: Membaca 15 menit"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {template === "water" ? (
            <>
              <div className="field-pair">
                <Field label="Catat air dalam">
                  <select
                    value={displayUnit}
                    onChange={(e) => {
                      const ml =
                        Number(target) *
                        (displayUnit === "liters" ? 1000 : Number(glassMl));
                      setDisplayUnit(e.target.value);
                      setTarget(
                        String(
                          Math.round(
                            (ml /
                              (e.target.value === "liters"
                                ? 1000
                                : Number(glassMl))) *
                              100,
                          ) / 100,
                        ),
                      );
                    }}
                  >
                    <option value="glasses">Gelas</option>
                    <option value="liters">Liter</option>
                  </select>
                </Field>
                <Field label="Ukuran gelas (ml)">
                  <input
                    type="number"
                    min="50"
                    max="2000"
                    step="1"
                    required
                    value={glassMl}
                    onChange={(e) => setGlassMl(e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={`Target air per hari (${displayUnit === "liters" ? "liter" : "gelas"})`}
                hint={`Setara ${((Number(target) * (displayUnit === "liters" ? 1000 : Number(glassMl))) / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} liter per hari.`}
              >
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </Field>
              <details className="water-preferences">
                <summary>Preferensi tubuh & perkiraan target</summary>
                <div className="field-pair">
                  <Field label="Tinggi badan (cm, opsional)">
                    <input
                      type="number"
                      min="50"
                      max="250"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </Field>
                  <Field label="Berat badan (kg, opsional)">
                    <input
                      type="number"
                      min="20"
                      max="300"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </Field>
                </div>
                <Button
                  variant="tonal"
                  disabled={
                    !weight || Number(weight) < 20 || Number(weight) > 300
                  }
                  onClick={() =>
                    setTarget(
                      String(
                        Math.round(
                          (waterEstimate(Number(weight)) /
                            (displayUnit === "liters"
                              ? 1000
                              : Number(glassMl))) *
                            100,
                        ) / 100,
                      ),
                    )
                  }
                >
                  Gunakan perkiraan berat badan
                </Button>
                <p className="meta">
                  Perkiraan awal untuk dewasa: 30 ml/kg per hari. Saran awal
                  aplikasi dibatasi 1,5–3 liter. Tinggi badan disimpan sebagai
                  preferensi dan tidak dipakai dalam rumus. Target tetap bisa
                  diubah.
                </p>
                <p className="meta">
                  Kebutuhan cairan juga dipengaruhi aktivitas, cuaca, makanan,
                  dan minuman lain. Jika ada pembatasan cairan, ikuti target
                  tenaga kesehatan.
                </p>
                <a
                  href="https://rightdecisions.scot.nhs.uk/media/l5cbmhjn/hydration-poster.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="hydration-source"
                >
                  Panduan hidrasi NHS
                </a>
              </details>
              <p className="meta">
                Ketuk +1 gelas setelah minum atau checklist untuk menandai
                target harian selesai.
              </p>
            </>
          ) : (
            <>
              <div className="field-pair">
                <Field label="Target per hari">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </Field>
                <Field label="Satuan">
                  <input
                    required
                    maxLength={30}
                    placeholder="kali, menit, halaman…"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Jumlah per ketukan">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={step}
                  onChange={(e) => setStep(e.target.value)}
                />
              </Field>
            </>
          )}
          {template !== "water" && (
            <Field label="Frekuensi">
              <select value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="daily">Harian</option>
                <option value="weekly">Mingguan</option>
              </select>
            </Field>
          )}
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
