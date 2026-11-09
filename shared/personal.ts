import { dayAdd, validDay } from "./life";

export type PersonalPreferences = {
  living: string;
  equipment: string;
  food: string;
  goals: string;
  communication: string;
  share_profile_with_ai: boolean;
  payday: number;
  base_salary: number;
  divisor: number;
  first_hours: number;
  first_rate: number;
  next_rate: number;
  holiday_divisor: number;
  holiday_hours: number;
  holiday_rate: number;
  holiday_next_rate: number;
  allowance: number;
};
export const PERSONAL_DEFAULTS: PersonalPreferences = {
  living: "",
  equipment: "",
  food: "",
  goals: "",
  communication: "",
  share_profile_with_ai: true,
  payday: 25,
  base_salary: 0,
  divisor: 173,
  first_hours: 1,
  first_rate: 1.5,
  next_rate: 2,
  holiday_divisor: 173,
  holiday_hours: 6,
  holiday_rate: 2,
  holiday_next_rate: 3,
  allowance: 0,
};
const ranges: Record<string, [number, number]> = {
  payday: [1, 31],
  base_salary: [0, 1e10],
  divisor: [1, 1000],
  holiday_divisor: [1, 1000],
  first_hours: [0, 24],
  first_rate: [0, 20],
  next_rate: [0, 20],
  holiday_hours: [0, 24],
  holiday_rate: [0, 20],
  holiday_next_rate: [0, 20],
  allowance: [0, 1e9],
};
export function personalPreferences(value: any): PersonalPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Profil tidak valid.");
  const out = { ...PERSONAL_DEFAULTS };
  for (const [key, raw] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(out, key))
      throw new Error(`Pengaturan ${key} tidak dikenal.`);
    if (ranges[key]) {
      const [min, max] = ranges[key];
      if (
        typeof raw !== "number" ||
        !Number.isFinite(raw) ||
        raw < min ||
        raw > max ||
        (key === "payday" && !Number.isInteger(raw))
      )
        throw new Error(`Nilai ${key} tidak valid.`);
    } else if (key === "share_profile_with_ai") {
      if (typeof raw !== "boolean")
        throw new Error("Pilihan berbagi profil tidak valid.");
    } else if (typeof raw !== "string" || raw.length > 2000)
      throw new Error("Teks profil maksimal 2.000 karakter per bagian.");
    (out as any)[key] = raw;
  }
  return out;
}
export function overtimeEstimate(
  hours: number,
  kind: string,
  p: PersonalPreferences,
) {
  if (
    !Number.isFinite(hours) ||
    hours <= 0 ||
    hours > 24 ||
    !["regular", "holiday"].includes(kind)
  )
    throw new Error("Jam lembur tidak valid.");
  if (!p.base_salary)
    throw new Error("Isi gaji dasar dan periksa rumus lembur terlebih dahulu.");
  const limit = kind === "holiday" ? p.holiday_hours : p.first_hours;
  const first = kind === "holiday" ? p.holiday_rate : p.first_rate;
  const next = kind === "holiday" ? p.holiday_next_rate : p.next_rate;
  const divisor = kind === "holiday" ? p.holiday_divisor : p.divisor;
  return (
    Math.round(
      ((p.base_salary / divisor) *
        (Math.min(hours, limit) * first + Math.max(0, hours - limit) * next) +
        p.allowance) *
        100,
    ) / 100
  );
}
export function monthDay(month: string, day: number) {
  const last = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
export function paydayForecast(
  date: string,
  payday: number,
  balance: number,
  bills: any[],
  payments: any[],
) {
  if (!validDay(date)) throw new Error("Tanggal tidak valid.");
  let next = monthDay(date.slice(0, 7), payday);
  // Today's balance already includes any salary actually received today.
  if (next <= date)
    next = monthDay(dayAdd(`${date.slice(0, 7)}-28`, 5).slice(0, 7), payday);
  const days = Math.round((Date.parse(next) - Date.parse(date)) / 86400000);
  const paid = new Set(payments.map((p) => `${p.bill_id}:${p.period}`));
  const pending: any[] = [];
  for (const bill of bills) {
    for (const month of new Set([date.slice(0, 7), next.slice(0, 7)])) {
      const due = monthDay(month, Number(bill.due_day));
      if (due < next && !paid.has(`${bill.id}:${month}`))
        pending.push({ ...bill, period: month, due_date: due });
    }
  }
  const reserved = pending.reduce((s, b) => s + Number(b.amount), 0);
  const available = balance - reserved;
  return {
    date,
    next_payday: next,
    days,
    balance,
    reserved,
    available,
    daily: Math.floor(Math.max(0, available) / Math.max(1, days)),
    bills: pending,
  };
}
export function weeklyPersonalReport(
  date: string,
  logs: any[],
  workouts: any[],
  transactions: any[],
  tasks: any[],
) {
  const start = dayAdd(date, -6);
  const inRange = (d: string) => d >= start && d <= date;
  const recent = logs.filter((l) => inRange(String(l.date)));
  const ordered = [...recent].sort(
    (a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      Date.parse(String(a.logged_at || a.created_at || a.date)) -
        Date.parse(String(b.logged_at || b.created_at || b.date)),
  );
  const sleeps = [
    ...new Map(
      ordered.filter((l) => l.kind === "sleep").map((l) => [l.date, l]),
    ).values(),
  ];
  const weights = ordered.filter((l) => l.kind === "weight");
  const tx = transactions.filter((t) =>
    inRange(String(t.date || t.occurred_at).slice(0, 10)),
  );
  const categories: Record<string, number> = {};
  for (const t of tx.filter((t) => t.type === "expense"))
    categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
  return {
    start,
    end: date,
    sleep_days: new Set(sleeps.map((l) => l.date)).size,
    average_sleep: sleeps.length
      ? sleeps.reduce((s, l) => s + Number(l.sleep_hours), 0) / sleeps.length
      : null,
    meals: recent.filter((l) => l.kind === "meal").length,
    weight_change:
      weights.length >= 2
        ? Number(weights[weights.length - 1].weight_kg) -
          Number(weights[0].weight_kg)
        : null,
    workouts: workouts.filter((w) => inRange(String(w.date))).length,
    expense: tx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0),
    income: tx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0),
    categories,
    tasks_done: tasks.filter((t) => t.is_done && inRange(String(t.date)))
      .length,
    tasks_pending: tasks.filter((t) => !t.is_done && String(t.date) <= date)
      .length,
  };
}
export function personalCycle(now: number, sleepItems: any[]) {
  const sleeps = sleepItems
    .filter((i) => i.kind === "sleep")
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  const current = sleeps.find(
    (s) => Date.parse(s.start_time) <= now && Date.parse(s.end_time) > now,
  );
  const previous = sleeps.filter((s) => Date.parse(s.end_time) <= now);
  const last = previous[previous.length - 1];
  const next = sleeps.find((s) => Date.parse(s.start_time) > now);
  return {
    asleep: !!current,
    wake_at: current?.end_time || last?.end_time || null,
    sleep_at: current?.start_time || next?.start_time || null,
  };
}
