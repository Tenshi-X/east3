import { useState } from "react";
import { api } from "./api";
import { Button, changed, ErrorState, Field, messageOf } from "./ui";
import { SHIFT_TYPES, dayAdd } from "../../shared/life";

export type ShiftDraft = {
  agent?: string;
  rows: { date: string; code: string | null; agent?: string }[];
  warnings?: string[];
};
export function attachedSevaSchedule(): ShiftDraft {
  const codes = [
    "2",
    "3",
    "3",
    "L",
    "L",
    "L",
    "1",
    "1",
    "1&2",
    "3",
    "L",
    "L",
    "L",
    "1",
    "1",
    "1&2",
    "3",
    "L",
    "L",
    "1",
    "1",
    "1&2",
    "2",
    "2&3",
    "L",
    "L",
    "1",
    "1",
    "1&2",
    "3",
    "3",
  ];
  return {
    agent: "Seva",
    rows: codes.map((code, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      code,
    })),
    warnings: [
      "Transkripsi lampiran Oktober 2026. Periksa dengan foto asli sebelum menyimpan.",
    ],
  };
}
export function ShiftReview({
  draft,
  onSaved,
}: {
  draft: ShiftDraft;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState(draft.rows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.life("save_shift_import", {
        rows: rows.map((r) => ({ ...r, agent: draft.agent || r.agent || "" })),
      });
      setSaved(true);
      changed();
      onSaved?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const months = [...new Set(rows.map((r) => r.date.slice(0, 7)))];
  const missing = months.flatMap((month) => {
    let date = `${month}-01`;
    const dates: string[] = [];
    while (date.startsWith(month)) {
      if (!rows.some((r) => r.date === date)) dates.push(date);
      date = dayAdd(date, 1);
    }
    return dates;
  });
  return (
    <div className="shift-review">
      <h3>Periksa jadwal {draft.agent || ""}</h3>
      <p className="meta">
        {rows.length} tanggal. Tanggal yang sama akan diperbarui; tanggal
        lainnya tetap tersimpan.
      </p>
      {draft.warnings?.map((w, i) => (
        <p className="life-notice" key={i}>
          {w}
        </p>
      ))}
      {!!missing.length && (
        <p className="life-notice">
          {missing.length} tanggal belum terbaca pada bulan ini. Isi tanggal
          yang kurang sebelum menganggap jadwal lengkap.
        </p>
      )}
      <div className="shift-review-list">
        {rows.map((row, i) => (
          <div className="field-pair" key={i}>
            <Field label={`Tanggal ${i + 1}`}>
              <input
                type="date"
                value={row.date}
                disabled={busy || saved}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r, n) =>
                      n === i ? { ...r, date: e.target.value } : r,
                    ),
                  )
                }
              />
            </Field>
            <Field label={`Shift ${row.date}`}>
              <select
                value={row.code || ""}
                disabled={busy || saved}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r, n) =>
                      n === i ? { ...r, code: e.target.value } : r,
                    ),
                  )
                }
              >
                <option value="">Perlu diperiksa</option>
                {Object.entries(SHIFT_TYPES).map(([code, s]) => (
                  <option key={code} value={code}>
                    {code} · {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </div>
      <Button
        variant="text"
        disabled={busy || saved || rows.length >= 62}
        onClick={() =>
          setRows((rs) => [
            ...rs,
            {
              date: rs.length
                ? dayAdd(rs[rs.length - 1].date, 1)
                : `${new Date().getFullYear()}-01-01`,
              code: null,
            },
          ])
        }
      >
        Tambah tanggal yang belum terbaca
      </Button>
      <ErrorState message={error} />
      <Button
        disabled={
          busy || saved || !rows.length || rows.some((r) => !r.code || !r.date)
        }
        onClick={() => void save()}
      >
        {saved
          ? "Jadwal tersimpan"
          : busy
            ? "Menyimpan…"
            : "Simpan jadwal yang diperiksa"}
      </Button>
    </div>
  );
}

export default function ShiftImport() {
  const [agent, setAgent] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const read = async (file?: File) => {
    if (!file) return;
    if (!agent.trim()) {
      setError("Isi nama pada baris jadwal yang ingin dibaca.");
      return;
    }
    if (
      file.size > 3 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Gunakan JPG, PNG, atau WebP maksimal 3 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setDraft(null);
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api.shiftPreview(image, agent.trim(), month);
      setDraft(result.draft);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card life-stack">
      <h2>Jadwal dari foto</h2>
      <p className="muted">
        Pilih namamu, unggah foto, lalu periksa hasilnya sekali.
      </p>
      <div className="field-pair">
        <Field label="Nama di jadwal">
          <input
            value={agent}
            maxLength={100}
            onChange={(e) => setAgent(e.target.value)}
            placeholder="Mis. Seva"
          />
        </Field>
        <Field label="Bulan jadwal">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
      </div>
      <Field label={busy ? "Sedang membaca foto…" : "Pilih foto jadwal"}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </Field>
      <ErrorState message={error} />
      {!draft && (
        <div className="life-actions">
          <Button
            variant="tonal"
            disabled={busy}
            onClick={() => setDraft(attachedSevaSchedule())}
          >
            Pratinjau lampiran Seva · Okt 2026
          </Button>
          <Button
            variant="text"
            disabled={busy}
            onClick={() =>
              setDraft({
                agent,
                rows: Array.from(
                  {
                    length: new Date(
                      Number(month.slice(0, 4)),
                      Number(month.slice(5)),
                      0,
                    ).getDate(),
                  },
                  (_, i) => ({
                    date: `${month}-${String(i + 1).padStart(2, "0")}`,
                    code: null,
                  }),
                ),
              })
            }
          >
            Isi jadwal sendiri
          </Button>
        </div>
      )}
      {draft && (
        <>
          <ShiftReview key={JSON.stringify(draft)} draft={draft} />
          <Button variant="text" onClick={() => setDraft(null)}>
            Tutup pratinjau
          </Button>
        </>
      )}
    </div>
  );
}
