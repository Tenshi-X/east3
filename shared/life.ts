export const SHIFT_TYPES: Record<
  string,
  { label: string; start: string; end: string; hours: number; color: string }
> = {
  "1": {
    label: "Pagi",
    start: "06:00",
    end: "14:00",
    hours: 8,
    color: "#0284c7",
  },
  "2": {
    label: "Sore",
    start: "14:00",
    end: "22:00",
    hours: 8,
    color: "#b77900",
  },
  "3": {
    label: "Malam",
    start: "22:00",
    end: "06:00",
    hours: 8,
    color: "#7c3aed",
  },
  "1&2": {
    label: "Pagi–sore",
    start: "06:00",
    end: "22:00",
    hours: 16,
    color: "#15803d",
  },
  "2&3": {
    label: "Sore–malam",
    start: "14:00",
    end: "06:00",
    hours: 16,
    color: "#4338ca",
  },
  L: { label: "Libur", start: "", end: "", hours: 0, color: "#be123c" },
};
export const DEFAULT_PROFILE = {
  meals_target: 3,
  sleep_hours: 8,
  wake_time: "07:00",
  bed_time: "23:00",
  commute_minutes: 30,
  handover_minutes: 30,
  workout_weekly: 2,
  workout_minutes: 30,
  preferences: "",
  reminders_enabled: false,
};
export function localDay(
  value: Date | string = new Date(),
  timezone = "Asia/Jakarta",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export function dayAdd(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function validDay(date: unknown): date is string {
  return (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
    dayAdd(date, 0) === date
  );
}
export function clockInZone(value: Date | string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
// Convert wall-clock time to an instant without relying on the server/browser timezone.
export function zonedTime(
  date: string,
  clock: string,
  timezone: string,
): string {
  if (!validDay(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))
    throw new Error("Tanggal atau jam tidak valid.");
  const target = Date.parse(`${date}T${clock}:00Z`);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const wall = Date.parse(
      `${localDay(new Date(instant), timezone)}T${clockInZone(new Date(instant), timezone)}:00Z`,
    );
    const correction = target - wall;
    instant += correction;
    if (!correction) return new Date(instant).toISOString();
  }
  throw new Error("Jam tidak tersedia pada zona waktu ini.");
}
export function shiftTimes(date: string, code: string, timezone: string) {
  const type = SHIFT_TYPES[code];
  if (!validDay(date) || !type)
    throw new Error("Tanggal atau kode shift tidak valid.");
  return {
    start_time: code === "L" ? null : zonedTime(date, type.start, timezone),
    end_time:
      code === "L"
        ? null
        : zonedTime(
            type.end <= type.start ? dayAdd(date, 1) : date,
            type.end,
            timezone,
          ),
  };
}
export function overlapsDay(
  start: string,
  end: string,
  date: string,
  timezone: string,
) {
  return (
    Date.parse(start) <
      Date.parse(zonedTime(dayAdd(date, 1), "00:00", timezone)) &&
    Date.parse(end) > Date.parse(zonedTime(date, "00:00", timezone))
  );
}
export const WORKOUT_TEMPLATES = [
  {
    name: "Full body A",
    exercises: [
      { name: "Squat ke kursi", defaultSets: 2, defaultReps: 8 },
      { name: "Push-up di dinding / meja", defaultSets: 2, defaultReps: 8 },
      { name: "Row dengan tas", defaultSets: 2, defaultReps: 10 },
      { name: "Dead bug", defaultSets: 2, defaultReps: 8 },
    ],
  },
  {
    name: "Full body B",
    exercises: [
      { name: "Glute bridge", defaultSets: 2, defaultReps: 10 },
      { name: "Split squat berpegangan", defaultSets: 2, defaultReps: 8 },
      { name: "Shoulder press dengan botol", defaultSets: 2, defaultReps: 8 },
      { name: "Bird dog", defaultSets: 2, defaultReps: 8 },
    ],
  },
];
export type PlanItem = {
  key: string;
  kind: "sleep" | "meal" | "workout" | "task" | "recovery";
  title: string;
  start_time: string;
  end_time: string;
  status?: string;
  flexible?: boolean;
  task_id?: string;
  exercises?: any[];
  note?: string;
};
type Interval = { start: number; end: number };
export function buildDailyPlan(input: {
  date: string;
  timezone: string;
  profile?: any;
  shifts?: any[];
  events?: any[];
  tasks?: any[];
  workouts?: any[];
  logs?: any[];
  programs?: any[];
}) {
  const { date, timezone } = input;
  const profile = { ...DEFAULT_PROFILE, ...input.profile };
  const shifts = (input.shifts || []).filter((s) => s.start_time && s.end_time);
  const t = (day: string, clock: string) =>
    Date.parse(zonedTime(day, clock, timezone));
  const begin = t(date, "00:00"),
    end = t(dayAdd(date, 1), "00:00");
  const minute = 60000,
    buffer =
      (Number(profile.commute_minutes) + Number(profile.handover_minutes)) *
      minute;
  const todayShifts = shifts.filter((s) => s.date === date);
  const previousNight = shifts.find(
    (s) => s.date < date && Date.parse(s.end_time) > begin,
  );
  const tomorrowEarly = shifts.find(
    (s) => s.date === dayAdd(date, 1) && ["1", "1&2"].includes(s.code),
  );
  const todayEarly = todayShifts.find((s) => ["1", "1&2"].includes(s.code));
  const sleepDuration = Number(profile.sleep_hours) * 60 * minute;
  const wake = todayEarly
    ? Date.parse(todayEarly.start_time) -
      Number(profile.commute_minutes) * minute -
      60 * minute
    : t(date, profile.wake_time);
  const bedtime = tomorrowEarly
    ? Date.parse(tomorrowEarly.start_time) -
      Number(profile.commute_minutes) * minute -
      60 * minute -
      sleepDuration
    : t(date, profile.bed_time);
  const busy: Interval[] = shifts.map((s) => ({
    start: Date.parse(s.start_time) - Number(profile.commute_minutes) * minute,
    end: Date.parse(s.end_time) + buffer,
  }));
  busy.push(
    ...(input.events || []).map((e) => ({
      start: Date.parse(e.start_time),
      end: Date.parse(e.end_time),
    })),
  );
  const items: PlanItem[] = [];
  const add = (
    key: string,
    kind: PlanItem["kind"],
    title: string,
    start: number,
    finish: number,
    extra: Partial<PlanItem> = {},
  ) => {
    if (start >= end || finish <= begin) return;
    items.push({
      key,
      kind,
      title,
      start_time: new Date(start).toISOString(),
      end_time: new Date(finish).toISOString(),
      ...extra,
    });
  };
  const sleep: Interval[] = [];
  // Work and fixed events take precedence. Never suggest sleep on top of either.
  const sleepBlock = (start: number, finish: number, key: string) => {
    let segments = [{ start, end: finish }];
    for (const block of busy)
      segments = segments.flatMap((s) =>
        block.end <= s.start || block.start >= s.end
          ? [s]
          : [
              { start: s.start, end: Math.min(s.end, block.start) },
              { start: Math.max(s.start, block.end), end: s.end },
            ].filter((v) => v.end > v.start),
      );
    for (const [i, s] of segments.entries())
      if (s.end - s.start >= 30 * minute) {
        sleep.push(s);
        add(`${key}-${i}`, "sleep", "Waktu tidur & pemulihan", s.start, s.end);
      }
  };
  if (previousNight)
    sleepBlock(
      Date.parse(previousNight.end_time) + buffer,
      Date.parse(previousNight.end_time) + buffer + sleepDuration,
      "sleep-recovery",
    );
  else sleepBlock(wake - sleepDuration, wake, "sleep-morning");
  const tonightShift = todayShifts.find((s) => s.code === "3");
  if (tonightShift && !previousNight)
    sleepBlock(
      Date.parse(tonightShift.start_time) - 3 * 60 * minute,
      Date.parse(tonightShift.start_time) - 60 * minute,
      "sleep-nap",
    );
  sleepBlock(bedtime, bedtime + sleepDuration, "sleep-night");
  const occupied = [...busy, ...sleep];
  const free = (start: number, finish: number, blocks = occupied) =>
    blocks.every((b) => finish <= b.start || start >= b.end);
  const findSlot = (duration: number, preferred: number, blocks = occupied) => {
    for (
      let at = Math.max(begin, preferred);
      at + duration <= Math.min(end, t(date, "21:00"));
      at += 15 * minute
    )
      if (free(at, at + duration, blocks)) return at;
    return null;
  };
  const awakeStart = previousNight
    ? Date.parse(previousNight.end_time) + buffer + sleepDuration
    : wake;
  const mealStart = Math.max(
    begin,
    Math.min(awakeStart + 15 * minute, end - 60 * minute),
  );
  // Meals may be reminders for a work break; the UI labels them as flexible.
  const awakeSlots: number[] = [];
  for (let at = mealStart; at + 20 * minute < end; at += 15 * minute)
    if (
      free(at, at + 20 * minute, [
        ...sleep,
        ...(input.events || []).map((e) => ({
          start: Date.parse(e.start_time),
          end: Date.parse(e.end_time),
        })),
      ])
    )
      awakeSlots.push(at);
  const mealCount = Number(profile.meals_target);
  let lastMeal = -Infinity;
  for (let i = 0; i < mealCount; i++) {
    const span = Math.min(
      5 * 60 * minute * Math.max(mealCount - 1, 1),
      (awakeSlots[awakeSlots.length - 1] || mealStart) - mealStart,
    );
    const preferred = mealStart + (i * span) / Math.max(mealCount - 1, 1);
    const index = awakeSlots.findIndex((v) => v >= preferred);
    const at = awakeSlots[index];
    if (at === undefined || at - lastMeal < 60 * minute) continue;
    lastMeal = at;
    add(
      `meal-${i + 1}`,
      "meal",
      `Makan ${i + 1} / bekal`,
      at,
      at + 20 * minute,
      {
        flexible: true,
        note: "Saat bekerja, sesuaikan dengan jeda yang diizinkan. Tambahkan sumber protein dan makanan yang kamu sukai.",
      },
    );
    occupied.push({ start: at, end: at + 20 * minute });
  }
  const logs = (input.logs || []).filter((l) => l.date === date);
  const energy = [...logs].reverse().find((l) => l.kind === "energy");
  const sleepLog = [...logs].reverse().find((l) => l.kind === "sleep");
  const workouts = (input.workouts || []).filter((w) => w.activity_type !== "jogging");
  const recent = workouts.filter(
    (w) => w.date >= dayAdd(date, -6) && w.date <= date,
  );
  const tooSoon = workouts.some(
    (w) => w.date >= dayAdd(date, -1) && w.date <= date,
  );
  const longShift = todayShifts.some((s) => SHIFT_TYPES[s.code]?.hours >= 12);
  const recovery =
    !!previousNight ||
    longShift ||
    Number(energy?.energy ?? 5) <= 2 ||
    (sleepLog && Number(sleepLog.sleep_hours) < 6);
  const reasons: string[] = [];
  if (recovery)
    reasons.push(
      previousNight
        ? "Selesai shift malam: utamakan tidur dan pemulihan."
        : longShift
          ? "Shift panjang: cukup jaga makan dan istirahat."
          : "Energi atau tidur sedang rendah: latihan ditunda.",
    );
  if (
    !recovery &&
    !tooSoon &&
    new Set(recent.map((w) => w.date)).size < Number(profile.workout_weekly)
  ) {
    const duration = Number(profile.workout_minutes) * minute;
    const at = findSlot(
      duration,
      Math.max(t(date, "08:00"), awakeStart + 60 * minute),
    );
    if (at !== null) {
      const programs = (input.programs || []).filter(
        (p) =>
          p.schedule_mode === "flexible" &&
          Array.isArray(p.exercises) &&
          p.exercises.length,
      );
      const template = (programs.length ? programs : WORKOUT_TEMPLATES)[
        new Set(workouts.filter((w) => w.date < date).map((w) => w.date)).size %
          (programs.length || WORKOUT_TEMPLATES.length)
      ];
      add("workout", "workout", template.name, at, at + duration, {
        exercises: template.exercises,
        note: "Pemanasan 5 menit. Mulai ringan, sisakan 2–3 repetisi yang masih mampu dilakukan. Hentikan gerakan yang menimbulkan nyeri.",
      });
      occupied.push({ start: at, end: at + duration });
    } else
      reasons.push(
        "Belum ada waktu latihan yang cukup di antara agenda dan tidur.",
      );
  } else if (!recovery)
    reasons.push(
      tooSoon
        ? "Berikan jeda pemulihan dari latihan terakhir."
        : "Target latihan tujuh hari terakhir sudah terpenuhi.",
    );
  const tasks = [...(input.tasks || [])]
    .filter((x) => !x.is_done && x.date <= date)
    .sort((a, b) =>
      String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")),
    );
  let count = 0;
  for (const task of tasks) {
    if (
      count >= (recovery ? 1 : 3) ||
      (recovery && task.energy === "high") ||
      (task.is_fixed && task.date !== date)
    )
      continue;
    const duration = Number(task.duration_minutes || 15) * minute;
    const at = findSlot(
      duration,
      Math.max(t(date, "08:00"), awakeStart + 30 * minute),
    );
    if (at === null) continue;
    add(`task-${task.id}`, "task", task.title, at, at + duration, {
      task_id: task.id,
      note:
        task.due_date && task.due_date < date
          ? `Lewat tenggat ${task.due_date}; perlu ditinjau.`
          : task.date < date
            ? "Usulan untuk tugas tertunda; tanggal asli tetap tersimpan."
            : undefined,
    });
    occupied.push({ start: at, end: at + duration });
    count++;
  }
  return {
    items: items.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    recovery,
    reasons,
    busy: [...busy, ...sleep].map((b) => ({
      start_time: new Date(b.start).toISOString(),
      end_time: new Date(b.end).toISOString(),
    })),
  };
}
