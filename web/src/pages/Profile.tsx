import { Button, Icon } from "../ui";
export default function Profile({
  user,
  onLogout,
}: {
  user: any;
  onLogout: () => void;
}) {
  const name = user?.display_name || "Pengguna";
  return (
    <div className="screen-scroll">
      <div className="content-width">
        <div className="profile-head">
          <div className="profile-avatar">{name.slice(0, 1).toUpperCase()}</div>
          <h2>{name}</h2>
          <p className="muted">{user?.email}</p>
        </div>
        <section className="card">
          <h2>Akun Atlas</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Agenda, keuangan, dan ruang pribadimu dalam satu tempat.
          </p>
        </section>
        <Button variant="tonal full profile-logout" onClick={onLogout}>
          <Icon name="logout" />
          Keluar dari akun
        </Button>
      </div>
    </div>
  );
}
