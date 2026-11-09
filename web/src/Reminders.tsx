import { useEffect, useState } from "react";
import { api } from "./api";
import { Button, changed, ErrorState, messageOf } from "./ui";
import { personalNative, PersonalDevice } from "./personalDevice";

export function ReminderSettings({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const toggle = async () => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if(!enabled&&personalNative){const r=await PersonalDevice.requestNotifications();if(!r.granted)throw new Error("Izinkan notifikasi di pengaturan HP untuk pengingat aktivitas.");}
      if (
        !enabled &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          setInfo(
            "Pengingat dalam aplikasi tetap aktif. Notifikasi perangkat belum diizinkan.",
          );
      }
      await api.life("update_health_profile", { reminders_enabled: !enabled });
      changed();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card life-stack">
      <h2>Pengingat mengikuti ritmemu</h2>
      <p className="meta">
        Pengingat mengikuti rencana terbaru dan menghindari waktu tidur.
        {personalNative?" APK menyimpan jadwal hingga hari berikutnya agar dapat mengingatkan saat ditutup. Buka Atlas untuk menyinkronkan perubahan; penghemat baterai dapat menunda notifikasi.":" Di browser, pengingat tersedia saat Atlas terbuka dan terlihat."}
      </p>
      <Button variant="tonal" disabled={busy} onClick={() => void toggle()}>
        {enabled
          ? "Nonaktifkan pengingat"
          : personalNative?"Aktifkan pengingat aktivitas":"Aktifkan pengingat saat aplikasi terbuka"}
      </Button>
      <ErrorState message={error} />
      {info && (
        <p role="status" className="meta">
          {info}
        </p>
      )}
    </section>
  );
}

export default function Reminders({ userId }: { userId: string }) {
  const [due, setDue] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      enabled = true,
      running = false;
    const sent = new Set<string>();
    const poll = async (refresh = false) => {
      if (
        !alive ||
        running ||
        (!enabled && !refresh) ||
        document.visibilityState !== "visible"
      )
        return;
      running = true;
      try {
        const context = await api.life("get");
        if (!alive || !context.plan) return;
        enabled = context.profile.reminders_enabled;
        if (!enabled) {
          setDue(null);
          return;
        }
        const now = Date.now();
        const asleep = context.plan.items.some(
          (i: any) =>
            i.kind === "sleep" &&
            Date.parse(i.start_time) <= now &&
            Date.parse(i.end_time) > now,
        );
        if (asleep) {
          setDue(null);
          return;
        }
        const item = context.plan.items.find(
          (i: any) =>
            i.kind !== "sleep" &&
            ["planned", "snoozed"].includes(i.status) &&
            Date.parse(i.start_time) <= now &&
            Date.parse(i.start_time) > now - 10 * 60000,
        );
        if (!item) return;
        const key = `atlas-reminder:${userId}:${context.date}:${item.key}:${item.start_time}`;
        if (sent.has(key) || sessionStorage.getItem(key)) return;
        sent.add(key);
        sessionStorage.setItem(key, "1");
        setDue({ item, date: context.date });
        if ("Notification" in window && Notification.permission === "granted") {
          const registration = await navigator.serviceWorker?.getRegistration();
          const options = {
            body: "Buka Atlas untuk mencatat, menunda, atau melewati aktivitas.",
            tag: key,
            icon: "/icons/icon-192.png",
          };
          if (registration)
            await registration.showNotification(item.title, options);
          else new Notification(item.title, options);
        }
      } catch {
        /* A failed refresh must never invent or repeat a reminder. */
      } finally {
        running = false;
      }
    };
    const refresh = () => {
      void poll(true);
    };
    const timer = window.setInterval(() => void poll(), 60000);
    window.addEventListener("atlas:data", refresh);
    document.addEventListener("visibilitychange", refresh);
    void poll();
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("atlas:data", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);
  const act = async (status: string) => {
    setBusy(true);
    setError("");
    try {
      await api.life("plan_state", {
        date: due.date,
        key: due.item.key,
        status,
      });
      setDue(null);
      changed();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  if (!due) return null;
  return (
    <aside
      className="life-reminder"
      aria-label="Pengingat aktivitas"
      role="status"
    >
      <strong>{due.item.title}</strong>
      <div className="life-actions">
        <Button disabled={busy} onClick={() => void act("done")}>
          Sudah
        </Button>
        <Button
          disabled={busy}
          variant="tonal"
          onClick={() => void act("snoozed")}
        >
          Tunda 30 mnt
        </Button>
        <Button
          disabled={busy}
          variant="text"
          onClick={() => void act("skipped")}
        >
          Lewati
        </Button>
      </div>
      <ErrorState message={error} />
      <Button variant="text" onClick={() => setDue(null)}>
        Tutup pengingat
      </Button>
    </aside>
  );
}
