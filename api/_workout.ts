import { query, queryOne, transaction } from "./_db";
import { dayAdd, localDay, validDay } from "../shared/life";
import {
  buildWorkoutWeek,
  weekStart,
  weeklyReport,
  ROUTINES,
} from "../shared/workout";

export async function getWorkoutWeek(
  userId: string,
  timezone: string,
  date: string,
) {
  const start = weekStart(date),
    end = dayAdd(start, 7);
  const [profile, shifts, events, wellness, sessions, checkins] =
    await Promise.all([
      queryOne("SELECT * FROM health_profiles WHERE user_id = $1", [userId]),
      query(
        "SELECT * FROM shift_assignments WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date ORDER BY date",
        [userId, dayAdd(start, -1), end],
      ),
      query(
        "SELECT * FROM events WHERE user_id = $1 AND end_time > $2::date - INTERVAL '1 day' AND start_time < $3::date + INTERVAL '1 day'",
        [userId, start, end],
      ),
      query(
        "SELECT * FROM wellness_logs WHERE user_id = $1 AND kind IN ('sleep', 'energy') AND date BETWEEN $2::date AND $3::date ORDER BY logged_at, id",
        [userId, start, end],
      ),
      query(
        "SELECT * FROM workout_logs WHERE user_id = $1 AND date >= $2::date AND date < $3::date ORDER BY date, created_at",
        [userId, dayAdd(start, -7), end],
      ),
      query(
        "SELECT * FROM workout_checkins WHERE user_id = $1 AND date >= $2::date AND date < $3::date",
        [userId, start, end],
      ),
    ]);
  const days = buildWorkoutWeek({
    date: start,
    timezone,
    profile,
    shifts,
    events,
    wellness,
    sessions,
    checkins,
  });
  return {
    start,
    timezone,
    days,
    sessions,
    report: weeklyReport(start, sessions, days),
    previous: weeklyReport(dayAdd(start, -7), sessions),
    missing_shifts: days.filter((d) => !d.shift).map((d) => d.date),
  };
}
export function validateSession(value: any, timezone: string) {
  const fail = () => {
    throw new Error(
      "Catatan sesi tidak valid. Periksa tanggal, durasi, jarak, dan set gerakan.",
    );
  };
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.client_id,
    ) ||
    !validDay(value.date) ||
    value.date > localDay(new Date(), timezone) ||
    !["workout", "jogging"].includes(value.activity_type) ||
    !Number.isInteger(value.duration_seconds) ||
    value.duration_seconds < 1 ||
    value.duration_seconds > 86400 ||
    typeof value.distance_meters !== "number" ||
    !Number.isFinite(value.distance_meters) ||
    value.distance_meters < 0 ||
    value.distance_meters > 200000 ||
    !["none", "gps", "manual"].includes(value.distance_source) ||
    (value.activity_type === "workout" && value.distance_meters !== 0) ||
    (value.distance_source === "none" && value.distance_meters !== 0) ||
    typeof value.notes !== "string" ||
    value.notes.length > 1000
  )
    fail();
  const started =
      value.started_at == null ? null : Date.parse(value.started_at),
    ended = value.ended_at == null ? null : Date.parse(value.ended_at);
  if (
    (started === null) !== (ended === null) ||
    (started !== null &&
      ended !== null &&
      (!Number.isFinite(started) ||
        !Number.isFinite(ended) ||
        ended < started ||
        ended > Date.now() + 60000 ||
        localDay(new Date(started), timezone) !== value.date ||
        value.duration_seconds * 1000 > ended - started + 1000))
  )
    fail();
  if (value.template_id && !ROUTINES.some((r) => r.id === value.template_id))
    fail();
  if (
    !Array.isArray(value.exercise_progress) ||
    value.exercise_progress.length > 20 ||
    value.exercise_progress.some(
      (e: any) =>
        !e ||
        typeof e.id !== "string" ||
        !ROUTINES.some((r) => r.exercises.includes(e.id)) ||
        !Array.isArray(e.sets) ||
        e.sets.length > 10 ||
        e.sets.some((s: any) => typeof s !== "boolean") ||
        !Number.isInteger(e.reps) ||
        e.reps < 1 ||
        e.reps > 100 ||
        e.unit !== (e.id === "plank" ? "seconds" : "reps"),
    ) ||
    new Set(value.exercise_progress.map((e: any) => e.id)).size !==
      value.exercise_progress.length
  )
    fail();
  return {
    client_id: value.client_id,
    date: value.date,
    activity_type: value.activity_type,
    duration_seconds: value.duration_seconds,
    duration_minutes: Math.round(value.duration_seconds / 60),
    distance_meters: value.distance_meters,
    distance_source: value.distance_source,
    started_at: started === null ? null : new Date(started).toISOString(),
    ended_at: ended === null ? null : new Date(ended!).toISOString(),
    notes: value.notes.trim(),
    template_id: value.template_id || null,
    exercise_progress: value.exercise_progress,
  };
}
export async function saveWorkoutSession(
  userId: string,
  timezone: string,
  value: any,
) {
  const row = validateSession(value, timezone);
  return transaction(async (sql) => {
    // Retrying after a lost response must return the original session, not duplicate it.
    const keys = Object.keys(row),
      values = Object.values(row).map((v, i) =>
        keys[i] === "exercise_progress" ? JSON.stringify(v) : v,
      );
    const [saved] = await sql(
      `INSERT INTO workout_logs (user_id, ${keys.join(",")}) VALUES ($1,${keys.map((_, i) => `$${i + 2}`).join(",")}) ON CONFLICT (user_id,client_id) DO UPDATE SET client_id = EXCLUDED.client_id RETURNING *`,
      [userId, ...values],
    );
    return { data: saved };
  });
}
export async function checkRestDay(
  userId: string,
  timezone: string,
  value: any,
) {
  if (
    !validDay(value?.date) ||
    value.date > localDay(new Date(), timezone) ||
    typeof value.completed !== "boolean"
  )
    throw new Error("Tanggal atau checklist tidak valid.");
  const week = await getWorkoutWeek(userId, timezone, value.date);
  const day = week.days.find((d) => d.date === value.date)!;
  if (day.activity !== "rest")
    throw new Error("Catat durasi latihan untuk menyelesaikan hari aktif.");
  const data = await queryOne(
    "INSERT INTO workout_checkins (user_id,date,completed,snapshot) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,date) DO UPDATE SET completed = EXCLUDED.completed, snapshot = EXCLUDED.snapshot RETURNING *",
    [userId, value.date, value.completed, JSON.stringify(day)],
  );
  return { data };
}
