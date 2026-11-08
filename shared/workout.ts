import { buildDailyPlan, dayAdd, validDay, zonedTime } from "./life";

export type Activity = "workout" | "jogging" | "rest";
export type WorkoutDay = {
  date: string;
  activity: Activity;
  title: string;
  template: string;
  start_time: string | null;
  end_time: string | null;
  minutes: number;
  reason: string;
  shift: string | null;
  completed: boolean;
};
export function weekStart(date: string) {
  if (!validDay(date)) throw new Error("Tanggal tidak valid.");
  return dayAdd(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
}
export const ROUTINES = [
  {
    id: "a",
    name: "Full body A",
    exercises: ["squat", "pushup", "row", "bridge", "plank"],
  },
  {
    id: "b",
    name: "Full body B",
    exercises: ["lunge", "pushup", "row", "press", "plank"],
  },
  {
    id: "c",
    name: "Full body C",
    exercises: ["squat", "press", "row", "bridge", "plank"],
  },
];
export function buildWorkoutWeek(input: {
  date: string;
  timezone: string;
  profile?: any;
  shifts?: any[];
  events?: any[];
  wellness?: any[];
  sessions?: any[];
  checkins?: any[];
}) {
  const start = weekStart(input.date),
    sessions = input.sessions || [];
  const previous = sessions.filter(
    (s) => s.activity_type !== "jogging" && s.date < start,
  );
  let lastStrength = Math.max(
    -Infinity,
    ...previous.map((s) =>
      Date.parse(s.started_at || zonedTime(s.date, "20:00", input.timezone)),
    ),
  );
  let strength = 0,
    jogging = 0;
  const days: WorkoutDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = dayAdd(start, i);
    const shift = input.shifts?.find((s) => s.date === date)?.code ?? null;
    const daily = buildDailyPlan({
      date,
      timezone: input.timezone,
      profile: { ...input.profile, workout_weekly: 5, workout_minutes: 30 },
      shifts: input.shifts,
      events: input.events,
      logs: input.wellness,
    });
    const slot = daily.items.find((s) => s.kind === "workout");
    let activity: Activity = "rest";
    if (slot && !daily.recovery) {
      const enoughRecovery =
        Date.parse(slot.start_time) - lastStrength >= 48 * 3600000;
      if (strength < 3 && enoughRecovery) activity = "workout";
      else if (jogging < 2 && i !== 3) activity = "jogging";
    }
    const routine = ROUTINES[strength % ROUTINES.length];
    let day: WorkoutDay = {
      date,
      activity,
      title:
        activity === "workout"
          ? routine.name
          : activity === "jogging"
            ? "Jogging santai"
            : "Istirahat & pemulihan",
      template: activity === "workout" ? routine.id : "",
      minutes: activity === "workout" ? 30 : activity === "jogging" ? 20 : 0,
      start_time: activity !== "rest" && slot ? slot.start_time : null,
      end_time:
        activity !== "rest" && slot
          ? new Date(
              Date.parse(slot.start_time) +
                (activity === "workout" ? 30 : 20) * 60000,
            ).toISOString()
          : null,
      shift,
      completed: false,
      reason: daily.recovery
        ? daily.reasons[0]
        : !slot
          ? "Belum ada slot di luar kerja, agenda, dan tidur."
          : activity === "rest"
            ? "Jeda pemulihan. Jalan ringan atau peregangan jika nyaman."
            : activity === "workout"
              ? "Latihan kekuatan di kos. Jeda minimal 48 jam antar sesi yang dijadwalkan."
              : "15–25 menit dengan kecepatan yang masih nyaman untuk berbicara.",
    };
    const check = input.checkins?.find((c) => c.date === date);
    const done = sessions.filter((s) => s.date === date);
    if (check)
      day = {
        ...day,
        ...check.snapshot,
        date,
        completed: check.completed === true,
      };
    if (done.length) {
      const s = done.find((s) => s.activity_type !== "jogging") || done[0];
      day = {
        ...day,
        activity: s.activity_type === "jogging" ? "jogging" : "workout",
        title: s.notes || "Latihan tercatat",
        template: s.template_id || day.template,
        completed: true,
      };
    }
    if (day.activity === "workout") {
      strength++;
      const actualStrength = done.filter((s) => s.activity_type !== "jogging");
      lastStrength = actualStrength.length
        ? Math.max(
            ...actualStrength.map((s) =>
              Date.parse(
                s.started_at || zonedTime(date, "20:00", input.timezone),
              ),
            ),
          )
        : Date.parse(
            day.start_time || zonedTime(date, "20:00", input.timezone),
          );
    } else if (day.activity === "jogging") jogging++;
    days.push(day);
  }
  return days;
}
export function sessionSeconds(s: any): number {
  return Number(s.duration_seconds ?? Number(s.duration_minutes || 0) * 60);
}
export function weeklyReport(
  start: string,
  sessions: any[],
  days: WorkoutDay[] = [],
) {
  const rows = sessions.filter(
    (s) => s.date >= start && s.date < dayAdd(start, 7),
  );
  const runs = rows.filter((s) => s.activity_type === "jogging");
  // Runs without a measured distance must not inflate the weighted pace.
  const measured = runs.filter(
    (s) => Number(s.distance_meters) > 0 && sessionSeconds(s) > 0,
  );
  const meters = measured.reduce((n, s) => n + Number(s.distance_meters), 0);
  const runSeconds = measured.reduce((n, s) => n + sessionSeconds(s), 0);
  const activeDays = new Set(rows.map((s) => s.date)).size;
  return {
    sessions: rows.length,
    strength: rows.length - runs.length,
    jogging: runs.length,
    active_days: activeDays,
    duration_seconds: rows.reduce((n, s) => n + sessionSeconds(s), 0),
    distance_meters: meters,
    pace_seconds: meters ? runSeconds / (meters / 1000) : null,
    completed_days: days.filter((d) => d.completed).length,
    completed_active: days.filter((d) => d.activity !== "rest" && d.completed)
      .length,
    planned_active: days.filter((d) => d.activity !== "rest").length,
    sets: rows.reduce(
      (n, s) =>
        n +
        (s.exercise_progress || []).reduce(
          (a: number, e: any) => a + (e.sets || []).filter(Boolean).length,
          0,
        ),
      0,
    ),
  };
}
export type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};
export function distanceBetween(a: GPSPoint, b: GPSPoint) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const x =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function gpsStep(previous: GPSPoint | null, point: GPSPoint) {
  if (
    ![point.latitude, point.longitude, point.accuracy, point.timestamp].every(
      Number.isFinite,
    ) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180 ||
    point.accuracy < 0 ||
    point.accuracy > 30
  )
    return { previous, meters: 0 };
  if (!previous) return { previous: point, meters: 0 };
  const seconds = (point.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0) return { previous, meters: 0 };
  // Reset after suspension or implausible jumps; never connect unobserved gaps.
  if (seconds > 30) return { previous: point, meters: 0 };
  const meters = distanceBetween(previous, point);
  if (meters / seconds > 7) return { previous, meters: 0 };
  if (meters < Math.max(4, Math.min(previous.accuracy, point.accuracy) * 0.5))
    return { previous, meters: 0 };
  return { previous: point, meters };
}
export function elapsedSeconds(
  session: { elapsed: number; runningSince: number | null },
  now = Date.now(),
) {
  return Math.floor(
    (session.elapsed +
      (session.runningSince === null
        ? 0
        : Math.max(0, now - session.runningSince))) /
      1000,
  );
}
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s / 60) % 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export function formatPace(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0)
    return "Belum tersedia";
  const n = Math.round(seconds);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")} /km`;
}
