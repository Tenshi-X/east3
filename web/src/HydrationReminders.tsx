import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as NativeApp } from "@capacitor/app";
import {
  HYDRATION_INTERVALS,
  hydrationSlots,
  nextHydrationTime,
  automaticHydrationTime,
  hydrationAwake,
  type HydrationSettings as Settings,
} from "../../shared/hydration";
import {
  HYDRATION_CHANGED,
  HYDRATION_SCHEDULE_CHANGED,
  NativeHydration,
  nativeHydration,
  readHydration,
  readHydrationSchedule,
  hydrationScheduleIssue,
  requestHydrationPermission,
  saveHydration,
  syncHydration,
} from "./hydration";
import { Button, ErrorState, Field, Form, messageOf } from "./ui";

export function HydrationSettings({ userId }: { userId: string }) {
  const [settings, setSettings] = useState(() => readHydration(userId));
  const [stored, setStored] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [permission, setPermission] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [schedule, setSchedule] = useState(() => readHydrationSchedule(userId));
  const [scheduleIssue, setScheduleIssue] = useState(() =>
    hydrationScheduleIssue(userId),
  );
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const current = readHydration(userId);
      setStored(current);
      setSettings(current);
      setNow(new Date());
      if (nativeHydration())
        void NativeHydration.checkPermission().then(
          (p) => {
            if (active) setPermission(p.granted);
          },
          () => {
            if (active) setPermission(false);
          },
        );
    };
    refresh();
    const refreshSchedule = () => {
      setSchedule(readHydrationSchedule(userId));
      setScheduleIssue(hydrationScheduleIssue(userId));
      setNow(new Date());
    };
    refreshSchedule();
    const tick = window.setInterval(() => setNow(new Date()), 60000);
    window.addEventListener(HYDRATION_CHANGED, refresh);
    window.addEventListener(HYDRATION_SCHEDULE_CHANGED, refreshSchedule);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(tick);
      window.removeEventListener(HYDRATION_CHANGED, refresh);
      window.removeEventListener(HYDRATION_SCHEDULE_CHANGED, refreshSchedule);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);
  const apply = async (next: Settings) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      hydrationSlots(next);
      if (next.enabled) await requestHydrationPermission();
      await saveHydration(userId, next);
      setPermission(true);
      setInfo(
        next.enabled
          ? "Pengingat minum air tersimpan."
          : "Pengingat minum air dinonaktifkan.",
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await requestHydrationPermission();
      await NativeHydration.testNotification();
      setInfo("Notifikasi percobaan dikirim. Periksa panel notifikasi HP.");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const nextAt =
    stored.mode === "automatic"
      ? automaticHydrationTime(schedule, stored.interval, now.getTime())
      : nextHydrationTime(stored, now).getTime();
  const format = (time: number) =>
    new Date(time).toLocaleString("id-ID", {
      ...(stored.mode === "automatic" && schedule
        ? { timeZone: schedule.timezone }
        : {}),
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const patch = (row: Partial<Settings>) =>
    setSettings((s) => ({ ...s, ...row }));
  return (
    <section className="card life-stack" aria-label="Pengingat minum air">
      <div>
        <p className="eyebrow">JANGAN LUPA MINUM</p>
        <h2>Pengingat minum air</h2>
      </div>
      <p className="meta">
        {nativeHydration()
          ? "Notifikasi tetap berjalan saat Atlas ditutup dan tanpa internet. Aktifkan izin notifikasi di HP."
          : "Di browser, pengingat bekerja selama Atlas terbuka. Gunakan APK Android untuk notifikasi saat aplikasi ditutup."}
      </p>
      <p role="status" className="life-notice">
        {!stored.enabled
          ? "Belum aktif"
          : !permission
            ? "Izin notifikasi belum aktif di HP."
            : `Aktif · setiap ${stored.interval} menit · ${stored.mode === "automatic" ? "Mengikuti shift & waktu tidur" : `${stored.start}-${stored.end}`}`}
        {stored.enabled && permission && nextAt !== null && (
          <span className="meta">{` · Berikutnya ${format(nextAt)}`}</span>
        )}
        {stored.enabled && stored.mode === "automatic" && nextAt === null && (
          <span className="meta">
            {" "}
            Buka Atlas saat online untuk menyinkronkan jadwal otomatis.
          </span>
        )}
      </p>
      <Form onSubmit={() => apply({ ...settings, enabled: true })}>
        <fieldset className="hydration-fields" disabled={busy}>
          <Field label="Jadwal pengingat">
            <select
              value={settings.mode}
              onChange={(e) =>
                patch({ mode: e.target.value as Settings["mode"] })
              }
            >
              <option value="automatic">
                Otomatis mengikuti shift & waktu tidur
              </option>
              <option value="manual">Atur jam secara manual</option>
            </select>
          </Field>
          {settings.mode === "manual" && (
            <div className="field-pair">
              <Field label="Mulai pengingat">
                <input
                  required
                  type="time"
                  value={settings.start}
                  onChange={(e) => patch({ start: e.target.value })}
                />
              </Field>
              <Field label="Selesai pengingat">
                <input
                  required
                  type="time"
                  value={settings.end}
                  onChange={(e) => patch({ end: e.target.value })}
                />
              </Field>
            </div>
          )}
          <Field label="Ingatkan setiap">
            <select
              value={settings.interval}
              onChange={(e) => patch({ interval: Number(e.target.value) })}
            >
              {HYDRATION_INTERVALS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} menit` : `${minutes / 60} jam`}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>
        <p className="meta">
          {settings.mode === "automatic"
            ? "Mengikuti jadwal shift serta jam bangun, jam tidur, dan target tidur di profil Kesehatan. Pengingat dijeda selama tidur, termasuk tidur pemulihan dan tidur singkat sebelum shift malam. Saat jadwal shift belum diisi, jam tidur profil digunakan."
            : "Mengikuti jam HP. Pengingat dimulai pada jam mulai dan berhenti sebelum jam selesai. Jadwal bisa melewati tengah malam untuk shift malam."}{" "}
          Waktu kirim dapat bergeser saat HP menghemat baterai.
        </p>
        {stored.mode === "automatic" && stored.enabled && schedule && (
          <p className="meta">
            Jadwal offline tersimpan sampai {format(schedule.validUntil)} (
            {schedule.timezone}). Perubahan shift dan profil disinkronkan saat
            Atlas terbuka dan online.
          </p>
        )}
        {stored.mode === "automatic" && stored.enabled && scheduleIssue && (
          <p role="status" className="meta">
            {scheduleIssue}
          </p>
        )}
        <div className="life-actions">
          <Button type="submit" disabled={busy}>
            {busy
              ? "Menyimpan…"
              : stored.enabled
                ? "Simpan jadwal minum"
                : "Aktifkan pengingat minum"}
          </Button>
          {stored.enabled && (
            <Button
              variant="text"
              disabled={busy}
              onClick={() => void apply({ ...stored, enabled: false })}
            >
              Matikan pengingat minum
            </Button>
          )}
          {nativeHydration() && (
            <Button variant="tonal" disabled={busy} onClick={() => void test()}>
              Tes notifikasi minum
            </Button>
          )}
        </div>
      </Form>
      <ErrorState message={error} />
      {info && (
        <p role="status" className="meta">
          {info}
        </p>
      )}
      <p className="meta">
        Jadwal tersimpan untuk akun ini di perangkat ini. Ketuk notifikasi untuk
        membuka Kebiasaan dan mencatat air yang diminum.
      </p>
    </section>
  );
}

export function useHydrationReminders(userId: string | null) {
  const nav = useNavigate();
  const [due, setDue] = useState(false);
  const reminderOwner = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    const handles: { remove(): Promise<void> }[] = [];
    if (reminderOwner.current !== userId) setDue(false);
    reminderOwner.current = userId;
    const refresh = (force = false) => {
      if (!active) return;
      void syncHydration(userId, force).catch(() => {});
      if (!nativeHydration() && userId && !readHydration(userId).enabled)
        setDue(false);
    };
    refresh(true);
    const register = async () => {
      if (!nativeHydration()) return;
      const listeners = await Promise.all([
        NativeHydration.addListener("notificationOpened", (event) => {
          if (active && userId && event.userId === userId) nav("/habits");
        }),
        NativeApp.addListener("appStateChange", (state) => {
          if (state.isActive) refresh(true);
        }),
      ]);
      if (!active) listeners.forEach((h) => void h.remove());
      else handles.push(...listeners);
    };
    void register().catch(() => {});
    const poll = () => {
      if (
        !active ||
        !userId ||
        nativeHydration() ||
        document.visibilityState !== "visible"
      )
        return;
      const settings = readHydration(userId);
      if (!settings.enabled) {
        setDue(false);
        return;
      }
      const now = new Date();
      const minute = now.getHours() * 60 + now.getMinutes();
      if (settings.mode === "automatic") {
        const schedule = readHydrationSchedule(userId);
        if (!hydrationAwake(schedule, now.getTime())) {
          setDue(false);
          return;
        }
        const at = automaticHydrationTime(
          schedule,
          settings.interval,
          now.getTime() - 60000,
        );
        if (at === null || at > now.getTime()) return;
      } else if (!hydrationSlots(settings).includes(minute)) return;
      const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const key = `atlas:hydration-sent:${userId}`;
      const sent = `${day}:${minute}`;
      if (localStorage.getItem(key) === sent) return;
      localStorage.setItem(key, sent);
      setDue(true);
      if ("Notification" in window && Notification.permission === "granted") {
        const options = {
          body: "Sempatkan minum air putih. Buka Kebiasaan untuk mencatatnya.",
          tag: "atlas-water",
          icon: "/icons/icon-192.png",
        };
        void (async () => {
          const worker = await navigator.serviceWorker?.getRegistration();
          if (worker)
            await worker.showNotification("Waktunya minum air putih", options);
          else new Notification("Waktunya minum air putih", options);
        })().catch(() => {});
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        refresh(true);
        poll();
      }
    };
    const timer = window.setInterval(poll, 15000);
    const syncTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30 * 60000);
    const settingsChanged = () => {
      refresh();
      poll();
    };
    const dataChanged = () => {
      refresh(true);
      setDue(false);
    };
    const scheduleChanged = () => {
      poll();
    };
    const online = () => refresh(true);
    poll();
    window.addEventListener(HYDRATION_CHANGED, settingsChanged);
    window.addEventListener(HYDRATION_SCHEDULE_CHANGED, scheduleChanged);
    window.addEventListener("atlas:data", dataChanged);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(syncTimer);
      handles.forEach((h) => void h.remove());
      window.removeEventListener(HYDRATION_CHANGED, settingsChanged);
      window.removeEventListener(HYDRATION_SCHEDULE_CHANGED, scheduleChanged);
      window.removeEventListener("atlas:data", dataChanged);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId, nav]);
  return due ? (
    <aside
      className="life-reminder"
      aria-label="Waktunya minum air putih"
      role="status"
    >
      <strong>Waktunya minum air putih</strong>
      <p className="meta">
        Ambil jeda sebentar untuk minum. Catat setelah kamu minum.
      </p>
      <div className="life-actions">
        <Button
          onClick={() => {
            setDue(false);
            nav("/habits");
          }}
        >
          Buka catatan minum
        </Button>
        <Button variant="text" onClick={() => setDue(false)}>
          Tutup
        </Button>
      </div>
    </aside>
  ) : null;
}
