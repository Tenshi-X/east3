import { useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  elapsedSeconds,
  gpsStep,
  type GPSPoint,
  type WorkoutDay,
} from "../../shared/workout";
import { loadUser } from "./api";
import { EXERCISES } from "./exercises";
import { ROUTINES } from "../../shared/workout";

export type SessionDraft = {
  version: 1;
  id: string;
  date: string;
  activity: "workout" | "jogging";
  title: string;
  template: string;
  startedAt: string;
  elapsed: number;
  runningSince: number | null;
  meters: number;
  gps: boolean;
  interrupted: boolean;
  progress: {
    id: string;
    reps: number;
    unit: "reps" | "seconds";
    sets: boolean[];
  }[];
};
const WorkoutScreen = registerPlugin<{
  setAwake(options: { enabled: boolean }): Promise<void>;
}>("WorkoutScreen");
export function useWorkoutSession() {
  const key = `atlas:workout:v1:${loadUser()?.id || "guest"}`;
  const [storageError, setStorageError] = useState("");
  const [draft, setDraft] = useState<SessionDraft | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        !saved ||
        saved.version !== 1 ||
        typeof saved.id !== "string" ||
        !["workout", "jogging"].includes(saved.activity) ||
        !Array.isArray(saved.progress) ||
        !Number.isFinite(saved.elapsed) ||
        saved.elapsed < 0 ||
        (saved.runningSince !== null && !Number.isFinite(saved.runningSince)) ||
        !Number.isFinite(saved.meters) ||
        saved.meters < 0 ||
        saved.progress.some(
          (p: any) =>
            !EXERCISES.some((e) => e.id === p?.id) ||
            !Array.isArray(p.sets) ||
            p.sets.some((s: any) => typeof s !== "boolean"),
        )
      )
        return null;
      // An interrupted run cannot reconstruct distance while the app was closed.
      if (saved.runningSince !== null) {
        saved.elapsed =
          saved.activity === "jogging"
            ? saved.elapsed
            : elapsedSeconds(saved) * 1000;
        saved.runningSince = null;
        saved.interrupted = true;
      }
      return saved;
    } catch {
      return null;
    }
  });
  const [now, setNow] = useState(Date.now());
  const [gpsMessage, setGpsMessage] = useState("");
  const previous = useRef<GPSPoint | null>(null);
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(key, JSON.stringify(draft));
      else localStorage.removeItem(key);
      setStorageError("");
    } catch {
      setStorageError(
        "Penyimpanan perangkat penuh atau tidak tersedia. Simpan sesi sebelum menutup aplikasi.",
      );
    }
  }, [draft, key]);
  useEffect(() => {
    if (!draft || draft.runningSince === null) return;
    const checkpoint = window.setInterval(() => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            ...draft,
            elapsed: elapsedSeconds(draft) * 1000,
            runningSince: Date.now(),
          }),
        );
      } catch {
        setStorageError(
          "Penyimpanan perangkat tidak tersedia. Simpan sesi sebelum menutup aplikasi.",
        );
      }
    }, 5000);
    return () => window.clearInterval(checkpoint);
  }, [draft, key]);
  useEffect(() => {
    if (!draft?.runningSince) return;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [draft?.runningSince]);
  useEffect(() => {
    const pauseHidden = () =>
      setDraft((d) =>
        d?.activity === "jogging" && d.runningSince !== null
          ? {
              ...d,
              elapsed: elapsedSeconds(d) * 1000,
              runningSince: null,
              interrupted: true,
            }
          : d,
      );
    const visibility = () => {
      if (document.hidden) pauseHidden();
    };
    document.addEventListener("visibilitychange", visibility);
    const listener = Capacitor.isNativePlatform()
      ? App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) pauseHidden();
        })
      : null;
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      void listener?.then((l) => l.remove());
    };
  }, []);
  useEffect(() => {
    if (
      draft?.activity !== "jogging" ||
      !draft.gps ||
      draft.runningSince === null
    )
      return;
    previous.current = null;
    let active = true;
    if (!navigator.geolocation) {
      setGpsMessage(
        "GPS tidak tersedia. Kamu tetap bisa memakai timer dan mengisi jarak manual.",
      );
      return;
    }
    setGpsMessage("Mencari sinyal GPS…");
    const id = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return;
        const p: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        if (p.accuracy > 30) {
          setGpsMessage(
            "Sinyal GPS lemah; titik yang kurang akurat diabaikan.",
          );
          return;
        }
        setGpsMessage(`GPS aktif · akurasi ±${Math.round(p.accuracy)} m`);
        const step = gpsStep(previous.current, p);
        previous.current = step.previous;
        if (step.meters)
          setDraft((d) =>
            d?.id === draft.id && d.runningSince !== null
              ? { ...d, meters: d.meters + step.meters }
              : d,
          );
      },
      (error) => {
        if (!active) return;
        previous.current = null;
        setGpsMessage(
          error.code === 1
            ? "Izin lokasi ditolak. Gunakan timer dan isi jarak manual."
            : "Lokasi belum tersedia. Coba di luar ruangan atau isi jarak manual.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    return () => {
      active = false;
      navigator.geolocation.clearWatch(id);
      previous.current = null;
    };
  }, [draft?.activity, draft?.gps, draft?.runningSince]);
  useEffect(() => {
    if (draft?.runningSince == null) return;
    if (Capacitor.isNativePlatform()) {
      void WorkoutScreen.setAwake({ enabled: true }).catch(() => {});
      return () => {
        void WorkoutScreen.setAwake({ enabled: false }).catch(() => {});
      };
    }
    let lock: any,
      released = false;
    const wake = (navigator as any).wakeLock;
    if (wake)
      void wake
        .request("screen")
        .then((value: any) => {
          lock = value;
          if (released) void lock.release();
        })
        .catch(() => {});
    return () => {
      released = true;
      if (lock) void lock.release();
    };
  }, [draft?.runningSince]);
  const start = (day: WorkoutDay, gps: boolean) => {
    const started = Date.now();
    const routine = ROUTINES.find((r) => r.id === day.template) || ROUTINES[0];
    setNow(started);
    setDraft({
      version: 1,
      id: crypto.randomUUID(),
      date: day.date,
      activity: day.activity === "jogging" ? "jogging" : "workout",
      title: day.title,
      template: day.template,
      startedAt: new Date(started).toISOString(),
      elapsed: 0,
      runningSince: started,
      meters: 0,
      gps,
      interrupted: false,
      progress:
        day.activity === "jogging"
          ? []
          : routine.exercises.map((id) => {
              const e = EXERCISES.find((e) => e.id === id)!;
              return { id, reps: e.reps, unit: e.unit, sets: [false, false] };
            }),
    });
  };
  const pause = () => {
    setNow(Date.now());
    setDraft((d) =>
      d && d.runningSince !== null
        ? {
            ...d,
            elapsed: d.elapsed + Math.max(0, Date.now() - d.runningSince),
            runningSince: null,
          }
        : d,
    );
  };
  const resume = () => {
    setNow(Date.now());
    setDraft((d) => (d ? { ...d, runningSince: Date.now() } : d));
  };
  return {
    draft,
    setDraft,
    seconds: draft ? elapsedSeconds(draft, now) : 0,
    storageError,
    gpsMessage,
    start,
    pause,
    resume,
    clear: () => setDraft(null),
  };
}
