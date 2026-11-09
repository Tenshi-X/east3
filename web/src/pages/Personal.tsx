import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, rupiah, todayStr } from "../api";
import {
  PERSONAL_DEFAULTS,
  type PersonalPreferences,
} from "../../../shared/personal";
import {
  Button,
  changed,
  EmptyState,
  ErrorState,
  Field,
  Form,
  LoadingState,
  Modal,
  Segments,
  messageOf,
  usePageLoad,
} from "../ui";
import { PersonalDevice, personalNative } from "../personalDevice";

const memoryTypes: Record<string, string> = {
  preference: "Preferensi",
  decision: "Keputusan",
  goal: "Target",
  context: "Konteks",
};
const blankMemory = {
  category: "preference",
  content: "",
  share_with_ai: true,
};
const blankProject = {
  name: "",
  goal: "",
  next_action: "",
  duration_minutes: 30,
  energy: "medium",
  status: "active",
  due_date: "",
};
const categoryLabels: Record<string, string> = {
  food: "Makanan",
  transport: "Transportasi",
  shopping: "Belanja",
  utilities: "Tagihan",
  salary: "Gaji",
  freelance: "Freelance",
  other: "Lainnya",
};
export default function Personal() {
  const nav = useNavigate();
  const [tab, setTab] = useState("profile"),
    [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  const [profile, setProfile] = useState<PersonalPreferences>({
    ...PERSONAL_DEFAULTS,
  });
  const [memory, setMemory] = useState<any>({ ...blankMemory }),
    [project, setProject] = useState<any>({ ...blankProject });
  const [bill, setBill] = useState({
    title: "",
    amount: "",
    due_day: "1",
    category: "utilities",
  });
  const [overtime, setOvertime] = useState({
    date: todayStr(),
    hours: "",
    kind: "regular",
  });
  const [payment, setPayment] = useState<any>(null),
    [backup, setBackup] = useState<any>(null);
  const upload = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const r = await api.personal();
      setData(r);
      setProfile({ ...PERSONAL_DEFAULTS, ...r.preferences });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  usePageLoad("/personal", load);
  const act = async (action: string, body: any, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const r = await api.personal(action, body);
      after?.();
      setInfo(r.message || "Disimpan.");
      changed();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = (kind: string, id: string) => {
    if (
      window.confirm(
        "Hapus data ini? Transaksi yang sudah dicatat tetap disimpan.",
      )
    )
      void act("delete", { kind, id });
  };
  const numberField = (
    key: keyof PersonalPreferences,
    label: string,
    min = 0,
    max = 1e10,
    step = 0.01,
  ) => (
    <Field key={key} label={label}>
      <input
        type="number"
        required
        min={min}
        max={max}
        step={step}
        value={Number(profile[key])}
        onChange={(e) =>
          setProfile({ ...profile, [key]: Number(e.target.value) })
        }
      />
    </Field>
  );
  return (
    <div className="screen-scroll">
      <div className="content-width personal-stack">
        <div className="personal-intro">
          <h2>Disesuaikan dengan hidupmu</h2>
          <p className="muted">
            Profil, keputusan, uang, dan project yang ingin kamu jaga.
          </p>
        </div>
        <div className="personal-tabs">
          <Segments
            label="Bagian pribadi"
            value={tab}
            onChange={setTab}
            options={[
              { value: "profile", label: "Profil" },
              { value: "memory", label: "Memori" },
              { value: "projects", label: "Project" },
              { value: "money", label: "Uang" },
              { value: "review", label: "Evaluasi" },
            ]}
          />
        </div>
        <ErrorState
          message={error}
          onRetry={!data ? () => void load() : undefined}
        />
        {info && (
          <p role="status" className="personal-notice">
            {info}
          </p>
        )}
        {loading && <LoadingState />}
        {data && tab === "profile" && (
          <>
            <section className="card personal-stack">
              <h2>Hal yang perlu Atlas pahami</h2>
              <p className="meta">
                Isi fakta dan preferensi yang masih berlaku. Profil kesehatan
                dan jadwal shift tetap memakai catatan yang sudah ada.
              </p>
              <Form onSubmit={() => act("profile", profile)}>
                {(
                  [
                    [
                      "living",
                      "Kondisi tempat tinggal",
                      "Contoh: kos, tanpa kulkas",
                    ],
                    [
                      "equipment",
                      "Alat yang tersedia",
                      "Contoh: pemanas listrik, matras",
                    ],
                    [
                      "food",
                      "Kebiasaan dan pilihan makanan",
                      "Contoh: makan dua kali, biasa membeli nasi ayam",
                    ],
                    [
                      "goals",
                      "Target pribadi yang sedang aktif",
                      "Apa yang ingin kamu capai?",
                    ],
                    [
                      "communication",
                      "Cara Atlas menjawab",
                      "Contoh: singkat, langsung ke langkah praktis",
                    ],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <Field key={key} label={label}>
                    <textarea
                      maxLength={2000}
                      placeholder={placeholder}
                      value={profile[key]}
                      onChange={(e) =>
                        setProfile({ ...profile, [key]: e.target.value })
                      }
                    />
                  </Field>
                ))}
                <label className="personal-checkbox">
                  <input
                    type="checkbox"
                    checked={profile.share_profile_with_ai}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        share_profile_with_ai: e.target.checked,
                      })
                    }
                  />
                  Gunakan profil ini dalam percakapan AI
                </label>
                <Button type="submit" disabled={busy}>
                  Simpan profil pribadi
                </Button>
              </Form>
              <div className="personal-actions">
                <Button variant="text" onClick={() => nav("/health")}>
                  Atur kesehatan & waktu tidur
                </Button>
                <Button variant="text" onClick={() => nav("/shifts")}>
                  Atur jadwal shift
                </Button>
              </div>
            </section>
            <section className="card personal-stack">
              <h2>Backup data pribadi</h2>
              <p className="meta">
                File JSON berisi catatan pribadi termasuk keuangan dan
                percakapan. Simpan di tempat yang kamu percaya. Kata sandi dan
                kunci API tidak disertakan.
              </p>
              <Button
                variant="tonal"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const r = await api.personal("backup");
                    const content = JSON.stringify(r, null, 2),
                      filename = `Atlas-Backup-${todayStr()}.json`;
                    if (personalNative)
                      await PersonalDevice.saveBackup({ content, filename });
                    else {
                      const url = URL.createObjectURL(
                        new Blob([content], { type: "application/json" }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = filename;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                    setInfo("Backup disiapkan untuk disimpan.");
                  } catch (e) {
                    setError(messageOf(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Unduh backup
              </Button>
              <input
                ref={upload}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > 4_500_000)
                      throw new Error("Backup maksimal 4,5 MB.");
                    const r = JSON.parse(await file.text());
                    if (
                      r.format !== "atlas-personal" ||
                      r.version !== 1 ||
                      !r.tables ||
                      Array.isArray(r.tables)
                    )
                      throw new Error("Format backup tidak didukung.");
                    setBackup(r);
                  } catch (e) {
                    setError(messageOf(e));
                  }
                }}
              />
              <Button
                variant="text"
                disabled={busy}
                onClick={() => upload.current?.click()}
              >
                Pilih backup untuk dipulihkan
              </Button>
            </section>
          </>
        )}
        {data && tab === "memory" && (
          <>
            <section className="card personal-stack">
              <h2>
                {memory.id ? "Ubah memori" : "Hal yang ingin kamu ingatkan"}
              </h2>
              <Form
                onSubmit={() =>
                  act("memory", memory, () => setMemory({ ...blankMemory }))
                }
              >
                <Field label="Jenis memori">
                  <select
                    value={memory.category}
                    onChange={(e) =>
                      setMemory({ ...memory, category: e.target.value })
                    }
                  >
                    {Object.entries(memoryTypes).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Isi memori">
                  <textarea
                    required
                    maxLength={2000}
                    value={memory.content}
                    onChange={(e) =>
                      setMemory({ ...memory, content: e.target.value })
                    }
                  />
                </Field>
                <label className="personal-checkbox">
                  <input
                    type="checkbox"
                    checked={memory.share_with_ai}
                    onChange={(e) =>
                      setMemory({ ...memory, share_with_ai: e.target.checked })
                    }
                  />
                  Boleh digunakan AI sebagai konteks
                </label>
                <div className="personal-actions">
                  <Button disabled={busy} type="submit">
                    Simpan memori
                  </Button>
                  {memory.id && (
                    <Button
                      variant="text"
                      onClick={() => setMemory({ ...blankMemory })}
                    >
                      Batal ubah
                    </Button>
                  )}
                </div>
              </Form>
            </section>
            {!data.memories.length && (
              <EmptyState title="Belum ada memori">
                Simpan preferensi atau keputusan yang ingin dipakai lagi.
              </EmptyState>
            )}
            {data.memories.map((m: any) => (
              <article className="card personal-stack" key={m.id}>
                <p className="meta">
                  {memoryTypes[m.category]} ·{" "}
                  {m.share_with_ai ? "Dipakai AI" : "Catatan pribadi"} ·{" "}
                  {new Date(m.updated_at).toLocaleDateString("id-ID")}
                </p>
                <p className="personal-content">{m.content}</p>
                <div className="personal-actions">
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() =>
                      setMemory({
                        id: m.id,
                        category: m.category,
                        content: m.content,
                        share_with_ai: m.share_with_ai,
                      })
                    }
                  >
                    Ubah memori
                  </Button>
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() => remove("memory", m.id)}
                  >
                    Hapus memori
                  </Button>
                </div>
              </article>
            ))}
          </>
        )}
        {data && tab === "projects" && (
          <>
            <section className="card personal-stack">
              <h2>
                {project.id
                  ? "Ubah project"
                  : "Project dan satu langkah berikutnya"}
              </h2>
              <Form
                onSubmit={() =>
                  act("project", project, () => setProject({ ...blankProject }))
                }
              >
                <Field label="Nama project">
                  <input
                    required
                    maxLength={100}
                    value={project.name}
                    onChange={(e) =>
                      setProject({ ...project, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Target project">
                  <textarea
                    maxLength={2000}
                    value={project.goal}
                    onChange={(e) =>
                      setProject({ ...project, goal: e.target.value })
                    }
                  />
                </Field>
                <Field label="Langkah berikutnya">
                  <textarea
                    maxLength={500}
                    value={project.next_action}
                    onChange={(e) =>
                      setProject({ ...project, next_action: e.target.value })
                    }
                  />
                </Field>
                <div className="personal-grid">
                  <Field label="Durasi langkah (menit)">
                    <input
                      type="number"
                      required
                      min={5}
                      max={240}
                      step={1}
                      value={project.duration_minutes}
                      onChange={(e) =>
                        setProject({
                          ...project,
                          duration_minutes: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Tenaga yang dibutuhkan">
                    <select
                      value={project.energy}
                      onChange={(e) =>
                        setProject({ ...project, energy: e.target.value })
                      }
                    >
                      <option value="low">Ringan</option>
                      <option value="medium">Sedang</option>
                      <option value="high">Tinggi</option>
                    </select>
                  </Field>
                </div>
                <Field label="Tenggat project (opsional)">
                  <input
                    type="date"
                    value={project.due_date}
                    onChange={(e) =>
                      setProject({ ...project, due_date: e.target.value })
                    }
                  />
                </Field>
                <Field label="Status project">
                  <select
                    value={project.status}
                    onChange={(e) =>
                      setProject({ ...project, status: e.target.value })
                    }
                  >
                    <option value="active">Aktif</option>
                    <option value="paused">Ditunda</option>
                    <option value="done">Selesai</option>
                  </select>
                </Field>
                <div className="personal-actions">
                  <Button type="submit" disabled={busy}>
                    Simpan project
                  </Button>
                  {project.id && (
                    <Button
                      variant="text"
                      onClick={() => setProject({ ...blankProject })}
                    >
                      Batal ubah
                    </Button>
                  )}
                </div>
              </Form>
            </section>
            {!data.projects.length && (
              <EmptyState title="Belum ada project">
                Tambahkan project yang sedang kamu kerjakan.
              </EmptyState>
            )}
            {data.projects.map((p: any) => (
              <article key={p.id} className="card personal-stack">
                <div>
                  <h2>{p.name}</h2>
                  <p className="meta">
                    {
                      { active: "Aktif", paused: "Ditunda", done: "Selesai" }[
                        p.status as string
                      ]
                    }{" "}
                    · {p.duration_minutes} menit · {p.pending_tasks || 0} tugas
                    aktif
                  </p>
                </div>
                <p className="personal-content">{p.goal}</p>
                {p.next_action && (
                  <p>
                    <strong>Berikutnya:</strong> {p.next_action}
                  </p>
                )}
                <div className="personal-actions">
                  <Button
                    disabled={
                      busy ||
                      p.status !== "active" ||
                      !p.next_action ||
                      Number(p.pending_tasks) > 0
                    }
                    onClick={() =>
                      void act("schedule_project", {
                        id: p.id,
                        date: todayStr(),
                      })
                    }
                  >
                    Masukkan ke rencana hari ini
                  </Button>
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() =>
                      setProject({
                        id: p.id,
                        name: p.name,
                        goal: p.goal,
                        next_action: p.next_action,
                        duration_minutes: p.duration_minutes,
                        energy: p.energy,
                        status: p.status,
                        due_date: p.due_date || "",
                      })
                    }
                  >
                    Ubah project
                  </Button>
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() => remove("project", p.id)}
                  >
                    Hapus project
                  </Button>
                </div>
              </article>
            ))}
          </>
        )}
        {data && tab === "money" && (
          <>
            <section className="card personal-stack">
              <h2>Sampai gajian berikutnya</h2>
              <p>
                Perkiraan tanggal {data.forecast.next_payday} ·{" "}
                {data.forecast.days} hari lagi
              </p>
              <dl className="personal-stats">
                <div>
                  <dt>Saldo tercatat</dt>
                  <dd>{rupiah(data.forecast.balance)}</dd>
                </div>
                <div>
                  <dt>Dicadangkan untuk tagihan</dt>
                  <dd>{rupiah(data.forecast.reserved)}</dd>
                </div>
                <div>
                  <dt>Dana setelah tagihan</dt>
                  <dd>{rupiah(data.forecast.available)}</dd>
                </div>
                <div>
                  <dt>Perkiraan per hari</dt>
                  <dd>{rupiah(data.forecast.daily)}</dd>
                </div>
              </dl>
              <p className="meta">
                Berdasarkan saldo awal kantong dan transaksi yang kamu catat.
                Gaji mendatang belum dihitung.{" "}
                {data.forecast.has_wallets
                  ? "Periksa kelengkapan saldo dan transaksi secara berkala."
                  : "Isi saldo awal kantong agar perkiraan dana lebih berguna."}
              </p>
              <Button variant="text" onClick={() => nav("/finance")}>
                Buka transaksi & kantong
              </Button>
            </section>
            <section className="card personal-stack">
              <h2>Tagihan bulanan</h2>
              <Form
                onSubmit={() =>
                  act(
                    "bill",
                    {
                      ...bill,
                      amount: Number(bill.amount),
                      due_day: Number(bill.due_day),
                    },
                    () => setBill({ ...bill, title: "", amount: "" }),
                  )
                }
              >
                <Field label="Nama tagihan">
                  <input
                    required
                    maxLength={100}
                    value={bill.title}
                    onChange={(e) =>
                      setBill({ ...bill, title: e.target.value })
                    }
                  />
                </Field>
                <div className="personal-grid">
                  <Field label="Nominal tagihan (Rp)">
                    <input
                      type="number"
                      required
                      min={0.01}
                      max={1e10}
                      step={0.01}
                      value={bill.amount}
                      onChange={(e) =>
                        setBill({ ...bill, amount: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Tanggal jatuh tempo bulanan">
                    <input
                      type="number"
                      required
                      min={1}
                      max={31}
                      value={bill.due_day}
                      onChange={(e) =>
                        setBill({ ...bill, due_day: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Button type="submit" disabled={busy}>
                  Tambah tagihan
                </Button>
              </Form>
              <p className="meta">
                Tanggal 29–31 mengikuti hari terakhir pada bulan yang lebih
                pendek.
              </p>
              {data.bills.map((b: any) => (
                <div key={b.id} className="personal-row">
                  <div>
                    <strong>{b.title}</strong>
                    <p className="meta">
                      {rupiah(Number(b.amount))} · tiap tanggal {b.due_day}
                    </p>
                  </div>
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() => remove("bill", b.id)}
                  >
                    Hapus tagihan
                  </Button>
                </div>
              ))}
              {data.forecast.bills.map((b: any) => (
                <div key={`${b.id}:${b.period}`} className="personal-row">
                  <p>
                    {b.title} · {b.due_date}
                  </p>
                  <Button
                    variant="tonal"
                    disabled={busy}
                    onClick={() =>
                      setPayment({
                        action: "pay_bill",
                        id: b.id,
                        period: b.period,
                        title: b.title,
                        amount: Number(b.amount),
                        date: todayStr(),
                      })
                    }
                  >
                    Catat pembayaran
                  </Button>
                </div>
              ))}
            </section>
            <section className="card personal-stack">
              <h2>Catat lembur</h2>
              <Form
                onSubmit={() =>
                  act(
                    "overtime",
                    { ...overtime, hours: Number(overtime.hours) },
                    () => setOvertime({ ...overtime, hours: "" }),
                  )
                }
              >
                <Field label="Tanggal lembur">
                  <input
                    type="date"
                    required
                    value={overtime.date}
                    onChange={(e) =>
                      setOvertime({ ...overtime, date: e.target.value })
                    }
                  />
                </Field>
                <div className="personal-grid">
                  <Field label="Jam lembur">
                    <input
                      type="number"
                      required
                      min={0.25}
                      max={24}
                      step={0.25}
                      value={overtime.hours}
                      onChange={(e) =>
                        setOvertime({ ...overtime, hours: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Jenis lembur">
                    <select
                      value={overtime.kind}
                      onChange={(e) =>
                        setOvertime({ ...overtime, kind: e.target.value })
                      }
                    >
                      <option value="regular">Hari kerja</option>
                      <option value="holiday">Hari libur</option>
                    </select>
                  </Field>
                </div>
                <Button type="submit" disabled={busy || !profile.base_salary}>
                  Simpan estimasi lembur
                </Button>
              </Form>
              {!profile.base_salary && (
                <p className="meta">
                  Isi gaji dasar dan periksa rumus pada pengaturan di bawah.
                </p>
              )}
              {data.overtime.map((o: any) => (
                <div key={o.id} className="personal-row">
                  <div>
                    <strong>
                      {o.date} · {o.hours} jam
                    </strong>
                    <p className="meta">
                      Estimasi {rupiah(Number(o.estimated_amount))}
                      {o.paid_at
                        ? ` · diterima ${rupiah(Number(o.received_amount))}`
                        : " · belum dibayar"}
                    </p>
                  </div>
                  {!o.paid_at && (
                    <Button
                      variant="tonal"
                      disabled={busy}
                      onClick={() =>
                        setPayment({
                          action: "receive_overtime",
                          id: o.id,
                          title: `Lembur ${o.date}`,
                          amount: Number(o.estimated_amount),
                          date: todayStr(),
                        })
                      }
                    >
                      Catat penerimaan
                    </Button>
                  )}
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() => remove("overtime", o.id)}
                  >
                    Hapus lembur
                  </Button>
                </div>
              ))}
            </section>
            <section className="card personal-stack">
              <h2>Gajian dan rumus lemburmu</h2>
              <p className="meta">
                Rumus ini adalah pengaturan perhitungan pribadi. Periksa sesuai
                aturan pembayaran tempat kerjamu. Catatan lama menyimpan salinan
                rumus saat dibuat.
              </p>
              <Form onSubmit={() => act("profile", profile)}>
                <div className="personal-grid">
                  {numberField("payday", "Tanggal gajian", 1, 31, 1)}
                  {numberField("base_salary", "Gaji dasar perhitungan (Rp)")}
                  {numberField("divisor", "Pembagi upah per jam", 1, 1000)}
                  {numberField(
                    "holiday_divisor",
                    "Pembagi upah hari libur",
                    1,
                    1000,
                  )}
                  {numberField("allowance", "Tambahan per sesi (Rp)")}
                  {numberField(
                    "first_hours",
                    "Batas jam awal hari kerja",
                    0,
                    24,
                  )}
                  {numberField(
                    "first_rate",
                    "Pengali jam awal hari kerja",
                    0,
                    20,
                  )}
                  {numberField(
                    "next_rate",
                    "Pengali jam lanjutan hari kerja",
                    0,
                    20,
                  )}
                  {numberField(
                    "holiday_hours",
                    "Batas jam awal hari libur",
                    0,
                    24,
                  )}
                  {numberField(
                    "holiday_rate",
                    "Pengali jam awal hari libur",
                    0,
                    20,
                  )}
                  {numberField(
                    "holiday_next_rate",
                    "Pengali jam lanjutan hari libur",
                    0,
                    20,
                  )}
                </div>
                <Button disabled={busy} type="submit">
                  Simpan pengaturan keuangan
                </Button>
              </Form>
            </section>
          </>
        )}
        {data && tab === "review" && (
          <section className="card personal-stack">
            <h2>Tujuh hari terakhir</h2>
            <p className="meta">
              {data.weekly.start} sampai {data.weekly.end}. Ini ringkasan
              catatan, bukan penilaian kesehatan atau penyebab suatu perubahan.
            </p>
            <dl className="personal-stats">
              <div>
                <dt>Rata-rata tidur tercatat</dt>
                <dd>
                  {data.weekly.average_sleep == null
                    ? "Belum ada data"
                    : `${data.weekly.average_sleep.toFixed(1)} jam`}
                </dd>
              </div>
              <div>
                <dt>Hari dengan catatan tidur</dt>
                <dd>{data.weekly.sleep_days} dari 7</dd>
              </div>
              <div>
                <dt>Makanan dicatat</dt>
                <dd>{data.weekly.meals}</dd>
              </div>
              <div>
                <dt>Sesi olahraga tercatat</dt>
                <dd>{data.weekly.workouts}</dd>
              </div>
              <div>
                <dt>Perubahan berat tercatat</dt>
                <dd>
                  {data.weekly.weight_change == null
                    ? "Perlu dua pengukuran"
                    : `${data.weekly.weight_change.toFixed(1)} kg`}
                </dd>
              </div>
              <div>
                <dt>Tugas bertanggal periode ini yang selesai</dt>
                <dd>{data.weekly.tasks_done}</dd>
              </div>
              <div>
                <dt>Tugas belum selesai sampai hari ini</dt>
                <dd>{data.weekly.tasks_pending}</dd>
              </div>
              <div>
                <dt>Pengeluaran tercatat</dt>
                <dd>{rupiah(data.weekly.expense)}</dd>
              </div>
            </dl>
            <h3>Pengeluaran menurut kategori</h3>
            {Object.entries(data.weekly.categories).map(([k, v]) => (
              <div className="personal-row" key={k}>
                <span>{categoryLabels[k] || k}</span>
                <strong>{rupiah(Number(v))}</strong>
              </div>
            ))}
            {!Object.keys(data.weekly.categories).length && (
              <p className="meta">
                Belum ada transaksi pengeluaran pada periode ini.
              </p>
            )}
            <p className="meta">
              Data yang belum dicatat belum bisa dievaluasi. Tidak ada target
              atau angka yang diisi otomatis.
            </p>
            <Button onClick={() => nav("/capture")}>
              Catat aktivitas sekarang
            </Button>
          </section>
        )}
        <Modal
          open={!!payment}
          title="Periksa pembayaran aktual"
          onClose={() => setPayment(null)}
          busy={busy}
        >
          {payment && (
            <Form
              onSubmit={() =>
                act(
                  payment.action,
                  {
                    id: payment.id,
                    period: payment.period,
                    amount: Number(payment.amount),
                    date: payment.date,
                  },
                  () => setPayment(null),
                )
              }
            >
              <p>{payment.title}</p>
              <Field label="Nominal aktual (Rp)">
                <input
                  type="number"
                  required
                  min={0.01}
                  step={0.01}
                  max={1e10}
                  value={payment.amount}
                  onChange={(e) =>
                    setPayment({ ...payment, amount: e.target.value })
                  }
                />
              </Field>
              <Field label="Tanggal pembayaran">
                <input
                  type="date"
                  required
                  value={payment.date}
                  onChange={(e) =>
                    setPayment({ ...payment, date: e.target.value })
                  }
                />
              </Field>
              <p className="meta">
                Menyimpan juga mencatat transaksi{" "}
                {payment.action === "pay_bill" ? "pengeluaran" : "pemasukan"}.
                Pastikan transaksi ini belum dicatat manual.
              </p>
              <ErrorState message={error} />
              <Button type="submit" disabled={busy}>
                Konfirmasi & catat transaksi
              </Button>
            </Form>
          )}
        </Modal>
        <Modal
          open={!!backup}
          title="Periksa pemulihan backup"
          onClose={() => setBackup(null)}
          busy={busy}
        >
          {backup && (
            <div className="personal-stack">
              <p>Dibuat: {backup.exported_at}</p>
              <p>
                {Object.values(backup.tables).reduce(
                  (s: number, rows: any) =>
                    s + (Array.isArray(rows) ? rows.length : 0),
                  0,
                )}{" "}
                baris pada backup.
              </p>
              <p>
                Baris dengan ID yang sama akan diperbarui. Baris di luar backup
                tetap disimpan. Hanya backup akunmu yang diterima.
              </p>
              <ErrorState message={error} />
              <Button
                disabled={busy}
                onClick={() =>
                  void act("restore", backup, () => setBackup(null))
                }
              >
                Pulihkan backup ini
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
