import { useState } from 'react';
import { api, setToken, saveUser } from '../api';

export default function Auth({ onAuthed }: { onAuthed: (u: any) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password, displayName || undefined);
      setToken(r.token);
      saveUser(r.user);
      onAuthed(r.user);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          east<span>3</span>
        </div>
        <div className="subtitle">Your Personal Life OS</div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                className="grow"
                placeholder="Nama tampilan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}
          <div className="row" style={{ marginBottom: 10 }}>
            <input
              className="grow"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <input
              className="grow"
              type="password"
              placeholder="Password (min. 6 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {err && <div className="error-box">{err}</div>}
          <button className="btn full" disabled={busy}>
            {busy ? 'Memproses…' : mode === 'login' ? 'Login' : 'Daftar'}
          </button>
        </form>
        <p style={{ marginTop: 16, textAlign: 'center', color: 'var(--muted)' }}>
          {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <a
            href="#"
            style={{ color: 'var(--accent2)' }}
            onClick={(e) => {
              e.preventDefault();
              setErr('');
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? 'Daftar' : 'Login'}
          </a>
        </p>
      </div>
    </div>
  );
}
