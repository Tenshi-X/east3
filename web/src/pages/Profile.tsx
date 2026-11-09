import { Button, Icon, Segments } from "../ui";
import { useTheme } from "../theme";
import { useNavigate } from "react-router-dom";
import { LockSettings } from "../PersonalLock";
export default function Profile({
  user,
  onLogout,
}: {
  user: any;
  onLogout: () => void;
}) {
  const name = user?.display_name || "Pengguna";
  const { preference, setPreference } = useTheme();
  const nav=useNavigate();
  return (
    <div className="screen-scroll">
      <div className="content-width">
        <div className="profile-head">
          <div className="profile-avatar">{name.slice(0, 1).toUpperCase()}</div>
          <h2>{name}</h2>
          <p className="muted">{user?.email}</p>
        </div>
        <section
          className="card theme-settings"
          aria-labelledby="theme-heading"
        >
          <div className="row">
            <div className="list-icon">
              <Icon name="dark_mode" />
            </div>
            <div className="grow">
              <h2 id="theme-heading">Tampilan</h2>
              <p className="meta">Pilih tema yang nyaman untukmu.</p>
            </div>
          </div>
          <Segments
            label="Tema aplikasi"
            value={preference}
            onChange={setPreference}
            options={[
              { value: "dark", label: "Gelap" },
              { value: "light", label: "Terang" },
              { value: "system", label: "Ikuti perangkat" },
            ]}
          />
          <p className="meta">Pilihan tema disimpan di perangkat ini.</p>
        </section>
        <section className="card">
          <h2>Atlas pribadi</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Agenda, keuangan, dan ruang pribadimu dalam satu tempat.
          </p>
          <Button variant="text" onClick={()=>nav("/personal")}>Kelola profil, memori & backup</Button>
        </section>
        <LockSettings userId={user.id}/>
        <Button variant="tonal full profile-logout" onClick={onLogout}>
          <Icon name="logout" />
          Keluar dari akun
        </Button>
      </div>
    </div>
  );
}
