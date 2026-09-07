import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getToken, setToken, loadUser, saveUser } from './api';
import { api } from './api';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/Calendar';
import Finance from './pages/Finance';
import Workout from './pages/Workout';
import Habits from './pages/Habits';
import Notes from './pages/Notes';
import AICopilot from './pages/AICopilot';
import Profile from './pages/Profile';

const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/calendar', label: 'Kalender', icon: '📅', end: false },
   { to: '/ai', label: 'AI', icon: '✨', end: false },
    { to: '/finance', label: 'Keuangan', icon: '💰', end: false },
     { to: '/profile', label: 'Profil', icon: '👤', end: false },
];

const QUICK_ACTIONS = [
  { label: 'New Task', icon: '✅', to: '/?new=task' },
  { label: 'New Event', icon: '📅', to: '/calendar?new=1' },
   { label: 'New Expense', icon: '💰', to: '/finance?new=1' },
    { label: 'New Note', icon: '📝', to: '/notes?new=1' },
];

function initials(u: any): string {
  const name = u?.display_name || u?.email || 'Atlas';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? 'A';
const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
 return (first + last).toUpperCase() || 'A';
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();
 const [user, setUser] = useState<any>(loadUser());
 const [loading, setLoading] = useState<boolean>(!!getToken());
 const [qaOpen, setQaOpen] = useState(false);

 useEffect(() => {
   if (!getToken()) { setLoading(false); return; }
   api.me().then((r: any) => { setUser(r.user); saveUser(r.user); }).catch(() => { setToken(null); saveUser(null); setUser(null); }).finally(() => setLoading(false));
 }, []);

 const logout = () => { setToken(null); saveUser(null); setUser(null); nav('/login'); };

 if (loading) return <div className="app-frame"><div className="center-loading">Memuat…</div></div>;

 if (!getToken()) {
   return <div className="app-frame"><Auth onAuthed={setUser} /></div>;
 }

 const titles: Record<string, string> = {
   '/': user?.display_name ? `Halo, ${user.display_name}` : 'Halo',
   '/calendar': 'Kalender',
    '/ai': 'Atlas AI',
     '/finance': 'Keuangan',
      '/profile': 'Profil',
 };
 const title = titles[loc.pathname] ?? 'Atlas';
 const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
 const runAction = (to: string) => { setQaOpen(false); nav(to); };

 return (
   <div className="app-frame">
     <header className="top-bar">
       <div>
         <h1>{title}</h1>
         <div className="sub">{todayLabel}</div>
       </div>
       <div className="actions">
         <button className="avatar" onClick={() => nav('/profile')}>{initials(user)}</button>
       </div>
     </header>
     <main className="app-content">
       <div className="page" key={loc.pathname}>
         <Routes>
           <Route path="/" element={<Dashboard user={user} />} />
           <Route path="/calendar" element={<CalendarPage />} />
           <Route path="/ai" element={<AICopilot />} />
           <Route path="/finance" element={<Finance />} />
           <Route path="/profile" element={<Profile user={user} onLogout={logout} />} />
           <Route path="/workout" element={<Workout />} />
           <Route path="/habits" element={<Habits />} />
           <Route path="/notes" element={<Notes />} />
           <Route path="*" element={<Navigate to="/" replace />} />
         </Routes>
       </div>
     </main>
     <button className={'fab' + (qaOpen ? ' open' : '')} onClick={() => setQaOpen(o => !o)} aria-label="Tambah cepat">+</button>
     <nav className="bottom-nav">
       {NAV.map(item => (
         <NavLink key={item.to} to={item.to} end={item.end} className="nav-item">{item.icon}<span>{item.label}</span></NavLink>
       ))}
     </nav>
     {qaOpen && (
       <div className="sheet-overlay" onClick={() => setQaOpen(false)}>
         <div className="sheet" onClick={(e) => e.stopPropagation()}>
           <div className="sheet-handle" />
           <div className="sheet-title">Tambah Cepat</div>
           <div className="qa-grid">
             {QUICK_ACTIONS.map(a => (
               <button key={a.label} className="qa-item" onClick={() => runAction(a.to)}>
                 <span className="qa-icon">{a.icon}</span>{a.label}
               </button>
             ))}
           </div>
         </div>
       </div>
     )}
   </div>
 );
}
