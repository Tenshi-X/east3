import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, getToken, setToken, loadUser, saveUser } from './api';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/Calendar';
import Finance from './pages/Finance';
import Workout from './pages/Workout';
import Habits from './pages/Habits';
import Notes from './pages/Notes';
import AICopilot from './pages/AICopilot';

export default function App() {
  const [user, setUser] = useState<any>(loadUser());
  const [loading, setLoading] = useState<boolean>(!!getToken());
  const nav = useNavigate();

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((r: any) => {
        setUser(r.user);
        saveUser(r.user);
      })
      .catch(() => {
        setToken(null);
        saveUser(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    setToken(null);
    saveUser(null);
    setUser(null);
    nav('/login');
  };

  if (loading) return <div className="center-loading">Memuat…</div>;

  if (!getToken()) {
    return (
      <Routes>
        <Route path="*" element={<Auth onAuthed={setUser} />} />
      </Routes>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          east<span>3</span>
        </div>
        <nav>
          <NavLink to="/" end>
            🏠 Dashboard
          </NavLink>
          <NavLink to="/calendar">📅 Calendar</NavLink>
          <NavLink to="/finance">💰 Finance</NavLink>
          <NavLink to="/workout">🏋️ Workout</NavLink>
          <NavLink to="/habits">✅ Habits</NavLink>
          <NavLink to="/notes">🧠 Notes</NavLink>
          <NavLink to="/copilot">🤖 AI Copilot</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="user-email">{user?.email ?? 'user'}</div>
          <button className="btn ghost full" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/copilot" element={<AICopilot />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
