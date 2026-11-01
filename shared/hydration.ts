import { buildDailyPlan, dayAdd, zonedTime } from "./life";

export const HYDRATION_INTERVALS = [30, 60, 90, 120, 180] as const;
export const HYDRATION_DAYS = 45;
export type HydrationSettings = {
  enabled: boolean;
  mode: "automatic" | "manual";
  start: string;
  end: string;
  interval: number;
};
export const DEFAULT_HYDRATION: HydrationSettings = {
  enabled: false,
  mode: "automatic",
  start: "08:00",
  end: "22:00",
  interval: 120,
};

export type AwakeWindow = { start: number; end: number };
export type HydrationSchedule = {
  timezone: string;
  validFrom: number;
  validUntil: number;
  windows: AwakeWindow[];
};

// Use the daily planner's sleep calculation, including pre-shift naps and
// recovery after overnight shifts. Windows span midnight without resetting.
export function buildHydrationSchedule(input: {
  date: string;
  timezone: string;
  profile?: any;
  shifts?: any[];
}): HydrationSchedule {
  const validFrom = Date.parse(zonedTime(input.date, "00:00", input.timezone));
  const validUntil = Date.parse(
    zonedTime(dayAdd(input.date, HYDRATION_DAYS), "00:00", input.timezone),
  );
  const begin = Date.parse(
    zonedTime(dayAdd(input.date, -1), "00:00", input.timezone),
  );
  const sleep: AwakeWindow[] = [];
  for (let offset = -1; offset <= HYDRATION_DAYS; offset++) {
    const plan = buildDailyPlan({ ...input, date: dayAdd(input.date, offset) });
    for (const item of plan.items) {
      if (item.kind === "sleep")
        sleep.push({
          start: Date.parse(item.start_time),
          end: Date.parse(item.end_time),
        });
    }
  }
  sleep.sort((a, b) => a.start - b.start);
  const windows: AwakeWindow[] = [];
  let cursor = begin;
  for (const block of sleep) {
    if (block.start > cursor && cursor < validUntil)
      windows.push({ start: cursor, end: Math.min(block.start, validUntil) });
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < validUntil) windows.push({ start: cursor, end: validUntil });
  return {
    timezone: input.timezone,
    validFrom,
    validUntil,
    windows: windows.filter((w) => w.end > validFrom),
  };
}

export function validHydrationSchedule(value: any): value is HydrationSchedule {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.timezone });
    return (
      Number.isFinite(value.validFrom) &&
      Number.isFinite(value.validUntil) &&
      value.validUntil > value.validFrom &&
      value.validUntil - value.validFrom <= 47 * 86400000 &&
      Array.isArray(value.windows) &&
      value.windows.length <= 200 &&
      value.windows.every(
        (w: AwakeWindow, i: number) =>
          Number.isFinite(w.start) &&
          Number.isFinite(w.end) &&
          w.start < w.end &&
          w.end <= value.validUntil &&
          (i === 0 || w.start >= value.windows[i - 1].end),
      )
    );
  } catch {
    return false;
  }
}

export function automaticHydrationTime(
  schedule: HydrationSchedule | null,
  interval: number,
  now: number,
): number | null {
  if (
    !schedule ||
    now >= schedule.validUntil ||
    !(HYDRATION_INTERVALS as readonly number[]).includes(interval)
  )
    return null;
  const step = interval * 60000;
  const after = Math.max(now, schedule.validFrom - 1);
  for (const window of schedule.windows) {
    const at =
      window.start +
      Math.max(0, Math.floor((after - window.start) / step) + 1) * step;
    if (at < window.end && at < schedule.validUntil) return at;
  }
  return null;
}

export function hydrationAwake(
  schedule: HydrationSchedule | null,
  now: number,
): boolean {
  return (
    !!schedule &&
    now >= schedule.validFrom &&
    now < schedule.validUntil &&
    schedule.windows.some((w) => w.start <= now && now < w.end)
  );
}

export function clockMinutes(clock: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))
    throw new Error("Isi jam mulai dan jam selesai dengan benar.");
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

export function hydrationSlots(settings: HydrationSettings): number[] {
  const start = clockMinutes(settings.start);
  const end = clockMinutes(settings.end);
  if (start === end) throw new Error("Jam mulai dan selesai harus berbeda.");
  if (!(HYDRATION_INTERVALS as readonly number[]).includes(settings.interval))
    throw new Error("Pilih interval pengingat yang tersedia.");
  const duration = (end - start + 1440) % 1440;
  const slots: number[] = [];
  for (let offset = 0; offset < duration; offset += settings.interval)
    slots.push((start + offset) % 1440);
  return slots;
}

export function nextHydrationTime(
  settings: HydrationSettings,
  now = new Date(),
) {
  const slots = hydrationSlots(settings);
  const candidates: Date[] = [];
  for (let day = 0; day <= 2; day++) {
    for (const slot of slots) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      date.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
      if (date.getTime() > now.getTime()) candidates.push(date);
    }
  }
  return new Date(Math.min(...candidates.map((date) => date.getTime())));
}
