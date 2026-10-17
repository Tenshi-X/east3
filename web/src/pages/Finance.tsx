import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, addDays, localDate, monthRange, rupiah, todayStr } from "../api";
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
  Section,
  Segments,
  useCreatePanel,
  useFeedback,
  usePageLoad,
} from "../ui";
const CATEGORIES: Record<string, string> = {
  food: "Makanan",
  transport: "Transportasi",
  shopping: "Belanja",
  health: "Kesehatan",
  entertainment: "Hiburan",
  education: "Pendidikan",
  utilities: "Tagihan",
  gym: "Olahraga",
  investment: "Investasi",
  salary: "Gaji",
  freelance: "Pekerjaan lepas",
  other: "Lainnya",
};
const WALLET_TYPES: Record<string, string> = {
  bank: "Rekening bank",
  ewallet: "E-wallet",
  cash: "Tunai",
  other: "Lainnya",
};
export default function Finance() {
  const nav = useNavigate();
  const panel = useCreatePanel("/finance");
  const feedback = useFeedback();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [tab, setTab] = useState<"transactions" | "wallets" | "budgets">(
    "transactions",
  );
  const [txs, setTxs] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState("");
  const [walletFilter, setWalletFilter] = useState("all");
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState("ewallet");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [budgetCategory, setBudgetCategory] = useState("food");
  const [limit, setLimit] = useState("");
  const routeParams = new URLSearchParams(useLocation().search);
  const presetType = routeParams.get("type");
  const kind = routeParams.get("kind");
  const formKind =
    kind === "budget" || kind === "wallet" ? kind : "transaction";
  useEffect(() => {
    if (!panel.open) {
      if (editingTx) {
        setAmount("");
        setNote("");
        setWalletId("");
        setDate(todayStr());
      }
      setEditingWallet(null);
      setEditingTx(null);
      setFormError("");
    }
  }, [panel.open]);
  useEffect(() => {
    if (panel.open && presetType === "expense") setType("expense");
  }, [panel.open, presetType]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tx, b, w] = await Promise.all([
        api.listAll("transactions", monthRange(month)),
        api.list("budgets", { filter_eq_month: month }),
        api.listAll("wallets", { order_by: "created_at", order_dir: "asc" }),
      ]);
      setTxs(tx.data || []);
      setBudgets(b.data || []);
      setWallets(w.data || []);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [month]);
  usePageLoad("/finance", load);
  const monthTx = useMemo(
    () =>
      txs
        .filter((t) => localDate(t.occurred_at).startsWith(month))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    [txs, month],
  );
  const income = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const visibleTx = monthTx.filter(
    (t) =>
      walletFilter === "all" ||
      (walletFilter === "unassigned"
        ? !t.wallet_id
        : t.wallet_id === walletFilter),
  );
  const groups = visibleTx.reduce((r: Record<string, any[]>, t) => {
    const key = localDate(t.occurred_at);
    (r[key] ||= []).push(t);
    return r;
  }, {});
  const spent = (cat: string) =>
    monthTx
      .filter((t) => t.type === "expense" && t.category === cat)
      .reduce((s, t) => s + Number(t.amount), 0);
  const lastDay =
    month === todayStr().slice(0, 7)
      ? todayStr()
      : todayStr(
          new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
        );
  const chart = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(lastDay, i - 6);
    const rows = monthTx.filter((t) => localDate(t.occurred_at) === day);
    return {
      day,
      income: rows
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0),
      expense: rows
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0),
    };
  });
  const max = Math.max(1, ...chart.flatMap((d) => [d.income, d.expense]));
  const openNew = () => {
    setFormError("");
    setEditingWallet(null);
    setEditingTx(null);
    if (tab === "wallets") {
      setWalletName("");
      setOpeningBalance("0");
    } else if (tab === "transactions") {
      setAmount("");
      setNote("");
      setDate(todayStr());
      setWalletId(
        wallets.some((w) => w.id === walletFilter) ? walletFilter : "",
      );
    }
    nav(
      tab === "budgets"
        ? "/finance?new=1&kind=budget"
        : tab === "wallets"
          ? "/finance?new=1&kind=wallet"
          : "/finance?new=1",
    );
  };
  const editWallet = (w: any) => {
    setEditingWallet(w.id);
    setWalletName(w.name);
    setWalletType(w.type);
    setOpeningBalance(String(w.opening_balance));
    setFormError("");
    nav("/finance?new=1&kind=wallet");
  };
  const editTransaction = (t: any) => {
    setEditingTx(t.id);
    setAmount(String(t.amount));
    setType(t.type);
    setCategory(t.category);
    setNote(t.note || "");
    setDate(localDate(t.occurred_at));
    setWalletId(t.wallet_id || "");
    setFormError("");
    nav("/finance?new=1");
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      if (formKind === "wallet") {
        const balance = Number(openingBalance);
        if (
          !walletName.trim() ||
          !openingBalance.trim() ||
          !Number.isFinite(balance)
        )
          throw new Error("Isi nama kantong dan saldo awal yang valid.");
        const row = {
          name: walletName.trim(),
          type: walletType,
          opening_balance: balance,
        };
        if (editingWallet) await api.update("wallets", editingWallet, row);
        else await api.create("wallets", row);
        panel.close();
        feedback.notify("Kantong disimpan");
        changed();
        return;
      }
      const value = Number(formKind === "budget" ? limit : amount);
      if (!Number.isFinite(value) || value <= 0)
        throw new Error("Masukkan jumlah lebih dari nol.");
      if (formKind === "budget") {
        await api.upsert(
          "budgets",
          { category: budgetCategory, monthly_limit: value, month },
          "user_id,category,month",
        );
        setLimit("");
      } else {
        const row = {
          amount: value,
          type,
          category,
          note: note.trim() || null,
          wallet_id: walletId || null,
          occurred_at: new Date(`${date}T12:00:00`).toISOString(),
        };
        if (editingTx) await api.update("transactions", editingTx, row);
        else await api.create("transactions", row);
        setAmount("");
        setNote("");
      }
      panel.close();
      feedback.notify(
        formKind === "budget" ? "Anggaran disimpan" : "Transaksi disimpan",
      );
      changed();
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const removeWallet = async (w: any) => {
    if (busy || !(await feedback.confirm(`Hapus kantong ${w.name}?`))) return;
    setBusy(true);
    try {
      await api.remove("wallets", w.id);
      if (walletFilter === w.id) setWalletFilter("all");
      if (walletId === w.id) setWalletId("");
      changed();
      feedback.notify("Kantong dihapus");
    } catch (e) {
      feedback.notify(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (t: any) => {
    if (busy || !(await feedback.confirm("Hapus transaksi ini?"))) return;
    setBusy(true);
    try {
      await api.remove("transactions", t.id);
      changed();
      feedback.notify("Transaksi dihapus");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  // A quick expense link always opens a transaction, including after using Anggaran.
  const transactionPanel = panel.open && formKind === "transaction";
  const options = Object.entries(CATEGORIES).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
  return (
    <>
      <div className="screen-scroll">
        <div className="content-width">
          <Field label="Periode">
            <input
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </Field>
          <ErrorState message={error} onRetry={() => void load()} />
          <section className="section card tonal-card">
            <p className="eyebrow">Sisa bulan ini</p>
            <p className="number">{rupiah(income - expense)}</p>
            <div className="summary-grid">
              <div>
                <p className="meta">Pemasukan</p>
                <p className="number green">{rupiah(income)}</p>
              </div>
              <div>
                <p className="meta">Pengeluaran</p>
                <p className="number red">{rupiah(expense)}</p>
              </div>
            </div>
            <details className="chart-disclosure">
              <summary>Arus kas 7 hari</summary>
              <div
                className="chart"
                role="img"
                aria-label="Grafik pemasukan dan pengeluaran tujuh hari terakhir periode ini"
              >
                {chart.map((d) => (
                  <div
                    className="chart-day"
                    key={d.day}
                    title={`${d.day}: pemasukan ${rupiah(d.income)}, pengeluaran ${rupiah(d.expense)}`}
                  >
                    <div
                      className="chart-bar income"
                      style={{ height: `${(d.income / max) * 100}%` }}
                    />
                    <div
                      className="chart-bar"
                      style={{ height: `${(d.expense / max) * 100}%` }}
                    />
                    <small>{new Date(`${d.day}T12:00:00`).getDate()}</small>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span className="green">■ Pemasukan</span>
                <span>■ Pengeluaran</span>
              </div>
              <table className="sr-only">
                <caption>Arus kas harian</caption>
                <tbody>
                  {chart.map((d) => (
                    <tr key={d.day}>
                      <th>{d.day}</th>
                      <td>{rupiah(d.income)}</td>
                      <td>{rupiah(d.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
          <div className="section">
            <Segments
              label="Bagian keuangan"
              value={tab}
              onChange={setTab}
              options={[
                { value: "transactions", label: "Transaksi" },
                { value: "wallets", label: "Kantong" },
                { value: "budgets", label: "Anggaran" },
              ]}
            />
          </div>
          {tab === "transactions" && (
            <Field label="Filter kantong">
              <select
                value={walletFilter}
                onChange={(e) => setWalletFilter(e.target.value)}
              >
                <option value="all">Semua kantong</option>
                <option value="unassigned">Tanpa kantong</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {loading ? (
            <LoadingState />
          ) : tab === "wallets" ? (
            <div className="stack">
              <div className="card tonal-card">
                <p className="eyebrow">Total saldo kantong</p>
                <p className="number">
                  {rupiah(
                    wallets.reduce(
                      (sum, w) => sum + Number(w.balance ?? w.opening_balance),
                      0,
                    ),
                  )}
                </p>
                <p className="meta">
                  Saldo awal + seluruh pemasukan − seluruh pengeluaran yang
                  terhubung. Tidak dibatasi periode bulan.
                </p>
              </div>
              {wallets.map((w) => (
                <div className="card" key={w.id}>
                  <div className="row between">
                    <div className="copy">
                      <h2>{w.name}</h2>
                      <p className="meta">{WALLET_TYPES[w.type]}</p>
                    </div>
                    <span className="list-icon">
                      <Icon name="account_balance_wallet" />
                    </span>
                  </div>
                  <p className="number wallet-balance">
                    {rupiah(Number(w.balance ?? w.opening_balance))}
                  </p>
                  <div className="row wrap">
                    <Button
                      variant="text"
                      onClick={() => {
                        setWalletFilter(w.id);
                        setTab("transactions");
                      }}
                    >
                      Lihat transaksi
                    </Button>
                    <IconButton
                      icon="edit_note"
                      label={`Ubah kantong ${w.name}`}
                      onClick={() => editWallet(w)}
                    />
                    <IconButton
                      icon="delete"
                      label={`Hapus kantong ${w.name}`}
                      disabled={busy}
                      onClick={() => void removeWallet(w)}
                    />
                  </div>
                </div>
              ))}
              {!wallets.length && !error && (
                <EmptyState
                  title="Pisahkan uangmu per kantong"
                  icon="account_balance_wallet"
                >
                  Tambahkan GoPay, rekening bank, e-wallet lain, atau uang
                  tunai.
                </EmptyState>
              )}
            </div>
          ) : tab === "transactions" ? (
            visibleTx.length ? (
              Object.entries(groups).map(([day, rows]) => (
                <section key={day}>
                  <h2 className="date-label">
                    {new Date(`${day}T12:00:00`).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                    })}
                  </h2>
                  <div className="list">
                    {rows.map((t) => (
                      <div className="list-row" key={t.id}>
                        <span className="list-icon">
                          <Icon
                            name={
                              t.type === "income"
                                ? "trending_up"
                                : "account_balance_wallet"
                            }
                          />
                        </span>
                        <div className="copy">
                          <strong>
                            {CATEGORIES[t.category] || t.category}
                          </strong>
                          {t.note && <p>{t.note}</p>}
                          <p className="meta">
                            {wallets.find((w) => w.id === t.wallet_id)?.name ||
                              "Tanpa kantong"}
                          </p>
                          <p className={t.type === "income" ? "green" : "red"}>
                            {t.type === "income" ? "+" : "−"}{" "}
                            {rupiah(Number(t.amount))}
                          </p>
                        </div>
                        <IconButton
                          icon="edit_note"
                          label={`Ubah transaksi ${t.note || CATEGORIES[t.category] || t.category}`}
                          disabled={busy}
                          onClick={() => editTransaction(t)}
                        />
                        <IconButton
                          icon="delete"
                          label={`Hapus transaksi ${t.note || CATEGORIES[t.category] || t.category}`}
                          disabled={busy}
                          onClick={() => void remove(t)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              !error && (
                <EmptyState
                  title="Belum ada transaksi"
                  icon="account_balance_wallet"
                >
                  Catat pemasukan atau pengeluaran pertamamu.
                </EmptyState>
              )
            )
          ) : budgets.length ? (
            <div className="stack">
              {budgets.map((b) => {
                const used = spent(b.category);
                const percent = Math.round(
                  (used / Number(b.monthly_limit)) * 100,
                );
                return (
                  <div className="card" key={b.id}>
                    <div className="row between wrap">
                      <h2>{CATEGORIES[b.category] || b.category}</h2>
                      <span className={percent > 100 ? "red" : "meta"}>
                        {percent}% terpakai
                      </span>
                    </div>
                    <p className="meta" style={{ marginTop: 8 }}>
                      {rupiah(used)} dari {rupiah(Number(b.monthly_limit))}
                    </p>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label={`Anggaran ${CATEGORIES[b.category] || b.category}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, percent)}
                    >
                      <div
                        className={percent > 100 ? "over" : ""}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !error && (
              <EmptyState title="Beri arah untuk pengeluaranmu" icon="savings">
                Tambahkan anggaran untuk bulan ini.
              </EmptyState>
            )
          )}
        </div>
      </div>
      <Fab
        label={
          tab === "budgets"
            ? "Anggaran baru"
            : tab === "wallets"
              ? "Kantong baru"
              : "Transaksi baru"
        }
        onClick={openNew}
      />
      <Modal
        open={panel.open}
        title={
          formKind === "wallet"
            ? editingWallet
              ? "Ubah kantong"
              : "Kantong baru"
            : transactionPanel
              ? editingTx
                ? "Ubah transaksi"
                : "Transaksi baru"
              : "Anggaran bulanan"
        }
        onClose={panel.close}
        busy={busy}
      >
        <Form onSubmit={save}>
          {formKind === "transaction" ? (
            <>
              <Segments
                label="Jenis transaksi"
                value={type}
                onChange={setType}
                options={[
                  { value: "expense", label: "Pengeluaran" },
                  { value: "income", label: "Pemasukan" },
                ]}
              />
              <Field label="Jumlah (Rp)">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field
                label="Kantong"
                hint="Transaksi lama tetap tersedia sebagai Tanpa kantong dan bisa diubah."
              >
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                >
                  <option value="">Tanpa kantong</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Kategori">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {options}
                </select>
              </Field>
              <Field label="Tanggal">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Catatan (opsional)">
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </>
          ) : formKind === "wallet" ? (
            <>
              <Field label="Nama kantong">
                <input
                  required
                  autoFocus
                  maxLength={80}
                  placeholder="Contoh: GoPay atau BCA utama"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                />
              </Field>
              <Field label="Jenis kantong">
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value)}
                >
                  {Object.entries(WALLET_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Saldo awal (Rp)"
                hint="Saldo sebelum transaksi yang dicatat di Atlas. Tidak dihitung sebagai pemasukan bulanan."
              >
                <input
                  type="number"
                  step="0.01"
                  required
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </Field>
              <div className="row wrap" aria-label="Pilihan kantong populer">
                {[
                  "GoPay",
                  "OVO",
                  "DANA",
                  "ShopeePay",
                  "BCA",
                  "Mandiri",
                  "Tunai",
                ].map((label) => (
                  <Button
                    key={label}
                    variant="tonal"
                    onClick={() => {
                      setWalletName(label);
                      setWalletType(
                        label === "Tunai"
                          ? "cash"
                          : ["BCA", "Mandiri"].includes(label)
                            ? "bank"
                            : "ewallet",
                      );
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Field label="Kategori anggaran">
                <select
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                >
                  {options}
                </select>
              </Field>
              <Field label="Batas pengeluaran (Rp)">
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0"
                  step="any"
                  autoFocus
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </Field>
              <p className="meta">
                Untuk periode {month}. Anggaran kategori yang sama akan
                diperbarui.
              </p>
            </>
          )}
          <ErrorState message={formError} />
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </Form>
      </Modal>
    </>
  );
}
