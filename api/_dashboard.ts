import { query } from "./_db";
import { dayAdd, validDay, zonedTime } from "../shared/life";

// One authenticated request for the home cards. Keep failures isolated per card.
export async function getDashboard(
  userId: string,
  timezone: string,
  date: string,
) {
  if (!validDay(date)) throw new Error("Tanggal tidak valid.");
  const month = date.slice(0, 7);
  const nextMonth = new Date(month + "-01T12:00:00Z");
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const start = zonedTime(date, "00:00", timezone);
  const end = zonedTime(dayAdd(date, 1), "00:00", timezone);
  const monthStart = zonedTime(month + "-01", "00:00", timezone);
  const monthEnd = zonedTime(
    nextMonth.toISOString().slice(0, 10),
    "00:00",
    timezone,
  );
  const reads: Record<string, () => Promise<any[]>> = {
    events: () =>
      query(
        "SELECT * FROM events WHERE user_id = $1 AND end_time > $2::timestamptz AND start_time < $3::timestamptz ORDER BY start_time, id",
        [userId, start, end],
      ),
    tasks: () =>
      query(
        "SELECT * FROM priorities WHERE user_id = $1 AND date = $2::date ORDER BY created_at, id",
        [userId, date],
      ),
    habits: () =>
      query(
        "SELECT * FROM habits WHERE user_id = $1 AND is_active = true ORDER BY created_at, id",
        [userId],
      ),
    logs: () =>
      query(
        "SELECT habit_logs.* FROM habit_logs JOIN habits ON habits.id = habit_logs.habit_id WHERE habits.user_id = $1 AND habit_logs.date = $2::date ORDER BY habit_logs.created_at, habit_logs.id",
        [userId, date],
      ),
    brief: () =>
      query(
        "SELECT * FROM morning_briefs WHERE user_id = $1 AND date = $2::date ORDER BY created_at DESC, id DESC LIMIT 1",
        [userId, date],
      ),
    // The home card needs totals, not every transaction in the month.
    tx: () =>
      query(
        "SELECT type, SUM(amount) AS amount FROM transactions WHERE user_id = $1 AND occurred_at >= $2::timestamptz AND occurred_at < $3::timestamptz GROUP BY type",
        [userId, monthStart, monthEnd],
      ),
    plans: () =>
      query(
        "SELECT * FROM workout_plans WHERE user_id = $1 ORDER BY created_at, id",
        [userId],
      ),
  };
  return Object.fromEntries(
    await Promise.all(
      Object.entries(reads).map(async ([key, read]) => {
        try {
          return [key, { data: await read(), error: "" }];
        } catch (error: any) {
          console.error("Dashboard card failed", {
            card: key,
            code: error.code,
          });
          return [
            key,
            { data: [], error: "Data belum dapat dimuat. Coba lagi." },
          ];
        }
      }),
    ),
  );
}
