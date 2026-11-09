import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, todayStr } from "./api";
import {
  Button,
  changed,
  ErrorState,
  Field,
  Form,
  messageOf,
  usePageLoad,
} from "./ui";
import { personalCycle } from "../../shared/personal";
export default function PersonalDay() {
  const nav = useNavigate(),
    [rhythm, setRhythm] = useState<any>(null),
    [sleep, setSleep] = useState(""),
    [energy, setEnergy] = useState("3"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  const id = useRef(crypto.randomUUID());
  const load = useCallback(async () => {
    try {
      const context = await api.life("get");
      setRhythm({
        ...personalCycle(Date.now(), context.plan.items),
        recovery: context.plan.recovery,
      });
      setError("");
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);
  usePageLoad("/", load);
  const clock = (v: string) =>
    new Date(v).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <section className="card personal-stack">
      <div>
        <h2>Bagaimana kondisimu sekarang?</h2>
        {rhythm && (
          <p className="meta">
            {rhythm.asleep
              ? `Jadwalmu sedang memasuki waktu tidur sampai ${clock(rhythm.wake_at)}.`
              : rhythm.wake_at
                ? `Ritme hari ini dimulai setelah bangun sekitar ${clock(rhythm.wake_at)}.`
                : "Isi jadwal tidur dan shift untuk mengikuti ritmemu."}{" "}
            {rhythm.recovery ? "Hari ini utamakan pemulihan." : ""}
          </p>
        )}
      </div>
      <Form
        onSubmit={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const r = await api.personal("checkin", {
              id: id.current,
              date: todayStr(),
              sleep_hours: Number(sleep),
              energy: Number(energy),
            });
            id.current = crypto.randomUUID();
            setInfo(r.message);
            setSleep("");
            changed();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="personal-grid">
          <Field label="Tidur terakhir (jam)">
            <input
              type="number"
              min={0}
              max={24}
              step={0.25}
              required
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
            />
          </Field>
          <Field label="Energi sekarang">
            <select value={energy} onChange={(e) => setEnergy(e.target.value)}>
              <option value="1">1 · Sangat lelah</option>
              <option value="2">2 · Lelah</option>
              <option value="3">3 · Cukup</option>
              <option value="4">4 · Baik</option>
              <option value="5">5 · Sangat baik</option>
            </select>
          </Field>
        </div>
        <Button variant="tonal" type="submit" disabled={busy}>
          Perbarui kondisi & rencana
        </Button>
      </Form>
      {info && <p role="status">{info}</p>}
      <ErrorState message={error} />
      <div className="personal-actions">
        <Button variant="text" onClick={() => nav("/capture")}>
          Catat cepat
        </Button>
        <Button variant="text" onClick={() => nav("/personal")}>
          Buka ruang pribadi
        </Button>
      </div>
    </section>
  );
}
