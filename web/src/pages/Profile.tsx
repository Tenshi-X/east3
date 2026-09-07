import { useNavigate } from 'react-router-dom';
const LINKS = [
{ to: '/workout', emoji: '🏋️', title: 'Workout', sub: 'Program latihan & progres' },
{ to: '/habits', emoji: '✅', title: 'Habits', sub: 'Checklist kebiasaan harian' },
{ to: '/notes', emoji: '📝', title: 'Second Brain', sub: 'Catatan & ide penting' },
{ to: '/calendar', emoji: '📅', title: 'Kalender', sub: 'Jadwal & agenda' },
{ to: '/finance', emoji: '💰', title: 'Keuangan', sub: 'Transaksi & budget' },
{ to: '/ai', emoji: '✨', title: 'AI Copilot', sub: 'Asisten AI personal' }
];
export default function Profile({ user, onLogout }: { user: any; onLogout: () => void }) {
const nav = useNavigate();
const name = user?.display_name || 'Pengguna';
const email = user?.email || '';
const initial = String(name).trim().slice(0, 2).toUpperCase() || 'A';
return (
<div>
<div className="profile-head">
<div className="profile-avatar">{initial}</div>
<div className="profile-name">{name}</div>
<div className="profile-email">{email}</div>
</div>
<div className="section">
{LINKS.map(l => (
<button key={l.to} className="link-row" onClick={() => nav(l.to)}>
<span className="link-emoji">{l.emoji}</span>
<span className="link-meta"><b>{l.title}</b><small>{l.sub}</small></span>
<span className="link-arrow">&gt;</span>
</button>
))}
</div>
<div className="divider" />
<button className="btn ghost full" onClick={() => { onLogout(); nav('/login'); }}>Keluar</button>
</div>
);
}