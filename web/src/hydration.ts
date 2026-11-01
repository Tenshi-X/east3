import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { api } from "./api";
import {
  DEFAULT_HYDRATION,
  clockMinutes,
  hydrationSlots,
  validHydrationSchedule,
  type HydrationSettings,
  type HydrationSchedule,
} from "../../shared/hydration";

type Permission = { granted: boolean };
interface HydrationPlugin {
  checkPermission(): Promise<Permission>;
  requestPermission(): Promise<Permission>;
  configure(options: {
    enabled: boolean;
    userId: string;
    startMinute: number;
    endMinute: number;
    interval: number;
    automatic: boolean;
    windows: { start: number; end: number }[];
    validFrom: number;
    validUntil: number;
  }): Promise<void>;
  testNotification(): Promise<void>;
  addListener(
    event: "notificationOpened",
    listener: (event: { userId: string }) => void,
  ): Promise<PluginListenerHandle>;
}
export const NativeHydration =
  registerPlugin<HydrationPlugin>("HydrationReminders");
export const nativeHydration = () => Capacitor.getPlatform() === "android";
export const HYDRATION_CHANGED = "atlas:hydration";
export const HYDRATION_SCHEDULE_CHANGED = "atlas:hydration-schedule";
const key = (userId: string) => `atlas:hydration:${userId}`;
const scheduleKey = (userId: string) => `atlas:hydration-schedule:${userId}`;

export function readHydration(userId: string): HydrationSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(key(userId)) || "null");
    if (!stored) return { ...DEFAULT_HYDRATION };
    const settings = {
      ...DEFAULT_HYDRATION,
      ...stored,
      enabled: stored.enabled === true,
    };
    hydrationSlots(settings);
    if (!["automatic", "manual"].includes(settings.mode))
      throw new Error("Invalid mode");
    return settings;
  } catch {
    return { ...DEFAULT_HYDRATION };
  }
}

// Serialize changes so an older account or focus refresh cannot restore a
// schedule after logout. Native storage keeps only the active account's alarm.
let queue: Promise<unknown> = Promise.resolve();
let activeUser: string | null = null;
let appliedSchedule = "";
const issues = new Map<string, string>();
const revisions = new Map<string, number>();
const pending = new Map<string, Promise<void>>();
export function readHydrationSchedule(
  userId: string,
): HydrationSchedule | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(scheduleKey(userId)) || "null",
    );
    return validHydrationSchedule(value) ? value : null;
  } catch {
    return null;
  }
}
export function hydrationScheduleIssue(userId: string) {
  return issues.get(userId) || "";
}
function scheduleChanged() {
  window.dispatchEvent(new Event(HYDRATION_SCHEDULE_CHANGED));
}
async function refreshSchedule(userId: string, force = false) {
  const cached = readHydrationSchedule(userId);
  const savedAt = Number(
    localStorage.getItem(`${scheduleKey(userId)}:updated`) || 0,
  );
  if (
    !force &&
    cached &&
    Date.now() >= cached.validFrom &&
    cached.validUntil > Date.now() &&
    Date.now() - savedAt < 30 * 60000
  )
    return;
  if (!force && pending.has(userId)) return pending.get(userId);
  const revision = (revisions.get(userId) || 0) + 1;
  revisions.set(userId, revision);
  const work = (async () => {
    try {
      const schedule = await api.life("hydration_schedule");
      if (activeUser !== userId || revisions.get(userId) !== revision) return;
      if (
        !validHydrationSchedule(schedule) ||
        schedule.validUntil <= Date.now()
      )
        throw new Error(
          "Jadwal otomatis belum tersedia. Perbarui backend Atlas dan coba lagi.",
        );
      localStorage.setItem(scheduleKey(userId), JSON.stringify(schedule));
      localStorage.setItem(
        `${scheduleKey(userId)}:updated`,
        String(Date.now()),
      );
      issues.delete(userId);
      scheduleChanged();
    } catch (error) {
      if (activeUser === userId && revisions.get(userId) === revision) {
        issues.set(
          userId,
          "Jadwal terbaru belum tersinkron. Jadwal tersimpan tetap dipakai selama masih berlaku.",
        );
        scheduleChanged();
      }
      throw error;
    }
  })();
  pending.set(userId, work);
  try {
    await work;
  } finally {
    if (pending.get(userId) === work) pending.delete(userId);
  }
}

function optionsFor(
  userId: string | null,
  settings: HydrationSettings,
  granted: boolean,
) {
  const automatic = settings.mode === "automatic";
  const schedule = userId && automatic ? readHydrationSchedule(userId) : null;
  return {
    enabled: Boolean(
      userId &&
      settings.enabled &&
      granted &&
      (!automatic || (schedule && schedule.validUntil > Date.now())),
    ),
    userId: userId || "",
    startMinute: clockMinutes(settings.start),
    endMinute: clockMinutes(settings.end),
    interval: settings.interval,
    automatic,
    windows: schedule?.windows || [],
    validFrom: schedule?.validFrom || 0,
    validUntil: schedule?.validUntil || 0,
  };
}
function sequential<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
export async function syncHydration(
  userId: string | null,
  force = false,
): Promise<void> {
  activeUser = userId;
  const settings = userId ? readHydration(userId) : { ...DEFAULT_HYDRATION };
  if (userId && settings.enabled && settings.mode === "automatic") {
    // Network reads stay outside the device queue so logout can cancel at once.
    await refreshSchedule(userId, force).catch(() => {});
  }
  return sequential(async () => {
    if (activeUser !== userId || !nativeHydration()) return;
    const settings = userId ? readHydration(userId) : { ...DEFAULT_HYDRATION };
    // Permission checks never open a permission prompt during startup/resume.
    const granted =
      settings.enabled && (await NativeHydration.checkPermission()).granted;
    if (activeUser !== userId) return;
    const options = optionsFor(userId, settings, granted);
    const signature = JSON.stringify(options);
    if (signature === appliedSchedule) return;
    await NativeHydration.configure(options);
    appliedSchedule = signature;
  });
}

export async function saveHydration(
  userId: string,
  settings: HydrationSettings,
) {
  hydrationSlots(settings);
  if (activeUser !== userId)
    throw new Error("Akun sudah berubah. Buka kembali pengaturan pengingat.");
  if (settings.enabled && settings.mode === "automatic") {
    await refreshSchedule(userId).catch(() => {});
    const cached = readHydrationSchedule(userId);
    if (!cached || cached.validUntil <= Date.now())
      throw new Error(
        "Jadwal otomatis belum dapat dimuat. Periksa koneksi lalu coba lagi.",
      );
  }
  return sequential(async () => {
    if (activeUser !== userId)
      throw new Error("Akun sudah berubah. Buka kembali pengaturan pengingat.");
    if (nativeHydration()) {
      const options = optionsFor(userId, settings, true);
      await NativeHydration.configure(options);
      appliedSchedule = JSON.stringify(options);
    }
    localStorage.setItem(key(userId), JSON.stringify(settings));
    window.dispatchEvent(new Event(HYDRATION_CHANGED));
  });
}

export async function requestHydrationPermission() {
  if (nativeHydration()) {
    if (!(await NativeHydration.requestPermission()).granted)
      throw new Error(
        "Izinkan notifikasi Atlas di Pengaturan HP, lalu coba aktifkan lagi.",
      );
    return;
  }
  // Foreground reminders also work without browser notification permission.
  if ("Notification" in window && Notification.permission === "default")
    await Notification.requestPermission();
}
