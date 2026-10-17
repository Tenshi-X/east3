import { useState } from "react";
import { api, saveUser, setToken } from "../api";
import { Button, ErrorState, Field, Icon, IconButton, messageOf } from "../ui";
export default function Auth({ onAuthed }: { onAuthed: (u: any) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(email, password, name || undefined);
      setToken(r.token);
      saveUser(r.user);
      onAuthed(r.user);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-scroll">
      <div className="auth-card">
        <div className="brand-mark">
          <Icon name="auto_awesome" />
        </div>
        <h1>Atlas</h1>
        <p className="muted">Ruang untuk harimu, dibantu AI.</p>
        <h2 style={{ marginBottom: 24 }}>
          {mode === "login" ? "Selamat datang kembali" : "Buat akun"}
        </h2>
        <form className="form" onSubmit={submit}>
          {mode === "register" && (
            <Field label="Nama">
              <input
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label="Kata sandi"
            hint={
              mode === "register" ? "Gunakan minimal 6 karakter." : undefined
            }
          >
            <div className="password-field">
              <input
                type={visible ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <IconButton
                icon={visible ? "visibility_off" : "visibility"}
                label={
                  visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                }
                onClick={() => setVisible((v) => !v)}
              />
            </div>
          </Field>
          <ErrorState message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
          </Button>
        </form>
        <div className="auth-switch">
          <span className="meta">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}
          </span>
          <Button
            variant="text"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Daftar" : "Masuk"}
          </Button>
        </div>
      </div>
    </main>
  );
}
