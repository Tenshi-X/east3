import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, todayStr, rupiah } from '../api';

const CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'health',
  'entertainment',
  'education',
  'utilities',
  'gym',
  'investment',
  'salary',
  'freelance',
  'other',
];

export default function Finance() {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [txs, setTxs] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());

  const [bCategory, setBCategory] = useState('food');
  const [bLimit, setBLimit] = useState('');

  const load = useCallback(async () => {
    try {
      const [tx, b] = await Promise.all([
        api.list('transactions', { limit: '200' }),
        api.list('budgets', { filter_eq_month: month }),
      ]);
      setTxs(tx.data ?? []);
      setBudgets(b.data ?? []);
    } catch (e: any) {
      setErr(e.message);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const monthTx = useMemo(
    () =>
      txs
        .filter((t) => (t.occurred_at ?? '').slice(0, 7) === month)
        .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)),
    [txs, month]
  );
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTx) {
      if (t.type === 'expense') map[t.category] = (map[t.category] ?? 0) + Number(t.amount);
    }
    return map;
  }, [monthTx]);

  const addTx = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr('Jumlah harus angka positif');
    setBusy(true);
    setErr('');
    try {
      await api.create('transactions', {
        amount: amt,
        type,
        category,
        note: note || null,
        occurred_at: date,
      });
      setAmount('');
      setNote('');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addBudget = async () => {
    const lim = Number(bLimit);
    if (!lim || lim <= 0) return setErr('Limit harus angka positif');
    setBusy(true);
    setErr('');
    try {
      await api.upsert('budgets', { category: bCategory, monthly_limit: lim, month }, 'user_id,category,month');
      setBLimit('');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeTx = async (id: string) => {
    await api.remove('transactions', id);
    load();
  };

  return (
    <FinanceView
      month={month}
      setMonth={setMonth}
      income={income}
      expense={expense}
      txs={monthTx}
      budgets={budgets}
      spentByCategory={spentByCategory}
      amount={amount}
      setAmount={setAmount}
      type={type}
      setType={setType}
      category={category}
      setCategory={setCategory}
      note={note}
      setNote={setNote}
      date={date}
      setDate={setDate}
      bCategory={bCategory}
      setBCategory={setBCategory}
      bLimit={bLimit}
      setBLimit={setBLimit}
      busy={busy}
      err={err}
      onAddTx={addTx}
      onAddBudget={addBudget}
      onRemoveTx={removeTx}
      categories={CATEGORIES}
    />
  );
}

function FinanceView(props: any) {
  const {
    month,
    setMonth,
    income,
    expense,
    txs,
    budgets,
    spentByCategory,
    amount,
    setAmount,
    type,
    setType,
    category,
    setCategory,
    note,
    setNote,
    date,
    setDate,
    bCategory,
    setBCategory,
    bLimit,
    setBLimit,
    busy,
    err,
    onAddTx,
    onAddBudget,
    onRemoveTx,
    categories,
  } = props;

  return (
    <div>
      <h1>💰 Finance Copilot</h1>
      <p className="page-sub">Catat transaksi & pantau budget bulanan</p>
      {err && <div className="error-box">{err}</div>}

      <div className="row wrap" style={{ marginBottom: 16 }}>
        <label style={{ color: 'var(--muted)' }}>Bulan:</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Pemasukan</h3>
          <div className="stat-value green">{rupiah(income)}</div>
        </div>
        <div className="card">
          <h3>Pengeluaran</h3>
          <div className="stat-value red">{rupiah(expense)}</div>
        </div>
      </div>

      <div className="grid cols-2 section">
        <div className="card">
          <h3>➕ Transaksi Baru</h3>
          <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
            <input
              type="number"
              placeholder="Jumlah (Rp)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: 140 }}
            />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input className="grow" placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn" onClick={onAddTx} disabled={busy}>
              Simpan
            </button>
          </div>
        </div>

        <div className="card">
          <h3>🎯 Budget {month}</h3>
          <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
            <select value={bCategory} onChange={(e) => setBCategory(e.target.value)}>
              {categories.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Limit (Rp)"
              value={bLimit}
              onChange={(e) => setBLimit(e.target.value)}
              style={{ width: 130 }}
            />
            <button className="btn" onClick={onAddBudget} disabled={busy}>
              Set
            </button>
          </div>
          {budgets.length === 0 && <p className="empty">Belum ada budget untuk bulan ini.</p>}
          {budgets.map((b: any) => {
            const spent = spentByCategory[b.category] ?? 0;
            const pct = Math.min(100, Math.round((spent / Number(b.monthly_limit)) * 100));
            const over = spent > Number(b.monthly_limit);
            return (
              <div key={b.id} style={{ marginBottom: 12 }}>
                <div className="row between">
                  <span>
                    {b.category} — {rupiah(spent)} / {rupiah(Number(b.monthly_limit))}
                  </span>
                  <span style={{ color: over ? 'var(--red)' : 'var(--muted)' }}>{pct}%</span>
                </div>
                <div className="progress">
                  <div className={over ? 'over' : ''} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section card">
        <h3>🧾 Transaksi {month}</h3>
        {txs.length === 0 && <p className="empty">Belum ada transaksi bulan ini.</p>}
        {txs.map((t: any) => (
          <div key={t.id} className="item">
            <span className="dot" style={{ background: t.type === 'income' ? 'var(--green)' : 'var(--red)' }} />
            <div className="title">
              <div>
                {t.type === 'income' ? '+' : '−'} {rupiah(Number(t.amount))}{' '}
                <span className="meta">
                  ({t.category}
                  {t.note ? ` — ${t.note}` : ''})
                </span>
              </div>
              <div className="meta">{(t.occurred_at ?? '').slice(0, 10)}</div>
            </div>
            <button className="btn danger" onClick={() => onRemoveTx(t.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

