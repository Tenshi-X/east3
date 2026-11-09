import { useState } from "react";
import { api, saveUser, setToken } from "../api";
import { Button, ErrorState, Field, Icon, IconButton, messageOf } from "../ui";
export default function Auth({ onAuthed }: { onAuthed: (u: any) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="auth-scroll">
      <div className="auth-card">
        <div className="brand-mark">
          <Icon name="auto_awesome" />
        </div>
        <h1>Atlas</h1>
        <p className="muted">Ruang untuk harimu, dibantu AI.</p>
        <h2 style={{ marginBottom: 24 }}>Selamat datang kembali</h2>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const r = await api.login(email, password);
              setToken(r.token);
              saveUser(r.user);
              onAuthed(r.user);
            } catch (e) {
              setError(messageOf(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Kata sandi">
            <div className="password-field">
              <input
                type={visible ? "text" : "password"}
                autoComplete="current-password"
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
                onClick={() => setVisible(!visible)}
              />
            </div>
          </Field>
          <ErrorState message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Memproses." : "Masuk"}
          </Button>
        </form>
        <p className="meta">
          Aplikasi pribadi. Masuk menggunakan akun pemilik.
        </p>
      </div>
    </main>
  );
}
