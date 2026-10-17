import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../ui";
const links: {
  to: string;
  title: string;
  description: string;
  icon: IconName;
}[] = [
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
      <div className="content-width">
        <p className="muted">Tempat untuk hal-hal yang penting bagimu.</p>
        <section className="section list">
          {links.map((l) => (
            <button
              type="button"
              className="list-row"
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
