import { useCallback, useState } from "react";
import { api, todayStr } from "../api";
import ShiftImport from "../ShiftImport";
import {
  Button,
  changed,
  ErrorState,
  Field,
  Form,
  LoadingState,
  messageOf,
  Section,
  usePageLoad,
} from "../ui";
import { SHIFT_TYPES, clockInZone, localDay } from "../../../shared/life";
export default function Shifts() {
  const [rows, setRows] = useState<any[]>([]);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [date, setDate] = useState(todayStr());
  const [code, setCode] = useState("1");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [r, ctx] = await Promise.all([
        api.listAll("shift_assignments", {
          order_by: "date",
          order_dir: "asc",
        }),
        api.life("get"),
      ]);
      setRows(r.data);
      setTimezone(ctx.timezone);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  usePageLoad("/shifts", load);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.life("change_shift", { date, code });
      changed();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="screen-scroll">
      <div className="content-width life-stack">
        <ShiftImport />
        <details className="card">
          <summary>Tambah / ubah satu hari</summary>
          <Form onSubmit={save}>
            <div className="field-pair">
              <Field label="Tanggal shift">
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Kode shift">
                <select value={code} onChange={(e) => setCode(e.target.value)}>
                  {Object.entries(SHIFT_TYPES).map(([k, s]) => (
                    <option key={k} value={k}>
                      {k} · {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              Simpan perubahan shift
            </Button>
          </Form>
        </details>
        <ErrorState message={error} onRetry={() => void load()} />
        <Section title="Jadwal tersimpan">
          {loading ? (
            <LoadingState />
          ) : (
            <div className="list">
              {rows.map((r) => (
                <div className="list-row" key={r.id}>
                  <span
                    className="shift-badge"
                    style={{ borderColor: SHIFT_TYPES[r.code].color }}
                  >
                    {r.code}
                  </span>
                  <div className="copy">
                    <strong>
                      {r.date} · {SHIFT_TYPES[r.code].label}
                    </strong>
                    <p>
                      {r.start_time
                        ? `${clockInZone(r.start_time, timezone)}–${clockInZone(r.end_time, timezone)}${localDay(r.end_time, timezone) > r.date ? " besok" : ""}`
                        : "Libur; periksa pemulihan shift sebelumnya."}
                    </p>
                  </div>
                  <Button
                    variant="text"
                    onClick={() => {
                      setDate(r.date);
                      setCode(r.code);
                      document
                        .querySelector(".content-width details")
                        ?.setAttribute("open", "");
                    }}
                  >
                    Ubah
                  </Button>
                </div>
              ))}
              {!rows.length && (
                <p className="muted">
                  Belum ada shift tersimpan. Impor foto untuk memulai.
                </p>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
