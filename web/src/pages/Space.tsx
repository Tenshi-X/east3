import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../ui";
const links: {
  to: string;
  title: string;
  description: string;
  icon: IconName;
}[] = [
  {
    to: "/health",
    title: "Kesehatan",
    description: "Makan, berat badan, tidur, dan perkembanganmu",
    icon: "trending_up",
  },
  {
    to: "/shifts",
    title: "Jadwal shift",
    description: "Impor foto dan atur pergantian shift",
    icon: "calendar_month",
  },
  {
    to: "/plan",
    title: "Rencana hari ini",
    description: "Aktivitas yang mengikuti waktu dan energimu",
    icon: "schedule",
  },
  {
    to: "/habits",
    title: "Kebiasaan",
    description: "Langkah kecil untuk hari yang lebih baik",
    icon: "checklist",
  },
  {
    to: "/workout",
    title: "Workout",
    description: "Program latihan dan riwayat aktivitas",
    icon: "fitness_center",
  },
  {
    to: "/notes",
    title: "Catatan",
    description: "Simpan ide dan temukan kembali",
    icon: "edit_note",
  },
];
export default function Space() {
  const nav = useNavigate();
  return (
    <div className="screen-scroll">
      <div className="content-width space-page">
        <div className="space-intro">
          <p className="muted">Tempat untuk hal-hal yang penting bagimu.</p>
          <h2>
            Rawat dirimu.
            <br />
            Atur keseharianmu.
          </h2>
        </div>
        <section className="section space-grid" aria-label="Fitur pribadi">
          {links.map((l) => (
            <button
              type="button"
              className="list-row space-link"
              key={l.to}
              onClick={() => nav(l.to)}
            >
              <span className="list-icon">
                <Icon name={l.icon} />
              </span>
              <span className="copy">
                <strong>{l.title}</strong>
                <p>{l.description}</p>
              </span>
              <Icon name="chevron_right" />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
