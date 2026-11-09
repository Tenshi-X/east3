import { useEffect, useRef, useState, type ReactNode } from "react";
import { App } from "@capacitor/app";
import { PersonalDevice, personalNative } from "./personalDevice";
import { Button, ErrorState, LoadingState, messageOf } from "./ui";
export function LockSettings({ userId }: { userId: string }) {
  const [status, setStatus] = useState<{
      available: boolean;
      enabled: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (personalNative)
      PersonalDevice.status({ userId })
        .then(setStatus)
        .catch((e) => setError(messageOf(e)));
  }, [userId]);
  return (
    <section className="card personal-stack">
      <h2>Kunci aplikasi</h2>
      <p className="meta">
        {personalNative
          ? "Gunakan biometrik atau kunci layar HP ketika membuka Atlas kembali. Pengaturan berlaku pada perangkat ini."
          : "Kunci dengan biometrik tersedia pada APK Android. Akses data tetap dibatasi ke akun pemilik di server."}
      </p>
      {personalNative && !status && !error && <LoadingState />}
      {status && (
        <Button
          variant="tonal"
          disabled={busy || !status.available}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await PersonalDevice.authenticate();
              await PersonalDevice.setLock({
                userId,
                enabled: !status.enabled,
              });
              setStatus({ ...status, enabled: !status.enabled });
              window.dispatchEvent(new Event("atlas:lock"));
            } catch (e) {
              setError(messageOf(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {status.enabled
            ? "Nonaktifkan kunci aplikasi"
            : "Aktifkan kunci aplikasi"}
        </Button>
      )}
      {status && !status.available && (
        <p className="meta">
          Atur PIN, pola atau biometrik di pengaturan keamanan HP terlebih
          dahulu.
        </p>
      )}
      <ErrorState message={error} />
    </section>
  );
}
export default function PersonalLock({
  userId,
  onLogout,
  children,
}: {
  userId: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(!personalNative),
    [locked, setLocked] = useState(personalNative),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const enabled = useRef(false),
    authenticating = useRef(false);
  useEffect(() => {
    if (!personalNative) return;
    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;
    const refresh = () => {
      void PersonalDevice.status({ userId })
        .then((s) => {
          if (active) {
            enabled.current = s.enabled;
            setLocked(s.enabled);
            setReady(true);
          }
        })
        .catch((e) => {
          if (active) {
            setError(messageOf(e));
            setReady(true);
            setLocked(true);
          }
        });
    };
    refresh();
    window.addEventListener("atlas:lock", refresh);
    void App.addListener("appStateChange", (s) => {
      if (!s.isActive && enabled.current && !authenticating.current)
        setLocked(true);
    }).then((h) => {
      if (!active) void h.remove();
      else listener = h;
    });
    return () => {
      active = false;
      window.removeEventListener("atlas:lock", refresh);
      void listener?.remove();
    };
  }, [userId]);
  if (!ready)
    return (
      <div className="app-frame">
        <LoadingState />
      </div>
    );
  if (locked)
    return (
      <main className="auth-scroll">
        <div className="auth-card personal-stack">
          <h1>Atlas terkunci</h1>
          <p>Buka dengan keamanan perangkatmu untuk melanjutkan.</p>
          <ErrorState message={error} />
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              authenticating.current = true;
              try {
                await PersonalDevice.authenticate();
                setLocked(false);
              } catch (e) {
                setError(messageOf(e));
              } finally {
                authenticating.current = false;
                setBusy(false);
              }
            }}
          >
            Buka Atlas
          </Button>
          <Button variant="text" disabled={busy} onClick={onLogout}>
            Keluar dari akun
          </Button>
        </div>
      </main>
    );
  return children;
}
