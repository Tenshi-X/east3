import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { api, getToken, loadUser, saveUser, setToken } from "./api";
import {
  closeTopOverlay,
  FeedbackProvider,
  Icon,
  IconButton,
  LoadingState,
  type IconName,
} from "./ui";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Finance from "./pages/Finance";
import AICopilot from "./pages/AICopilot";
import Profile from "./pages/Profile";
import Workout from "./pages/Workout";
import Habits from "./pages/Habits";
import Notes from "./pages/Notes";
import Space from "./pages/Space";

type ScreenConfig = {
  title: string;
  parent?: string;
  icon?: IconName;
  label?: string;
};
const SCREENS: Record<string, ScreenConfig> = {
  "/": { title: "Hari ini", icon: "home", label: "Beranda" },
  "/calendar": { title: "Kalender", icon: "calendar_month", label: "Kalender" },
  "/ai": { title: "Atlas AI", icon: "auto_awesome", label: "AI" },
  "/finance": {
    title: "Keuangan",
    icon: "account_balance_wallet",
    label: "Keuangan",
  },
  "/space": { title: "Ruang Saya", icon: "grid_view", label: "Ruang Saya" },
  "/profile": { title: "Profil", parent: "/space" },
  "/workout": { title: "Workout", parent: "/space" },
  "/habits": { title: "Kebiasaan", parent: "/space" },
  "/notes": { title: "Catatan", parent: "/space" },
};
const TABS = Object.entries(SCREENS).filter(([, s]) => s.label);

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();
  const [user, setUser] = useState<any>(loadUser());
  const [loading, setLoading] = useState(!!getToken());
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set([loc.pathname]),
  );
  const [keyboard, setKeyboard] = useState(false);
  const profileOrigin = useRef("/space");
  const session = !!getToken();
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    let active = true;
    api
      .me()
      .then((r) => {
        if (active) {
          setUser(r.user);
          saveUser(r.user);
        }
      })
      .catch(() => {
        if (active) {
          setToken(null);
          saveUser(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => {
    setVisited((previous) => new Set([...previous, loc.pathname]));
  }, [loc.pathname]);
  const goBack = useCallback(async () => {
    if (keyboard && Capacitor.isNativePlatform()) {
      await Keyboard.hide();
      return;
    }
    if (closeTopOverlay()) return;
    if (!getToken() && Capacitor.isNativePlatform()) {
      await NativeApp.minimizeApp();
      return;
    }
    if (loc.search) {
      nav(loc.pathname, { replace: true });
      return;
    }
    const parent =
      loc.pathname === "/profile"
        ? profileOrigin.current
        : SCREENS[loc.pathname]?.parent;
    if (parent) nav(parent);
    else if (loc.pathname !== "/") nav("/");
    else if (Capacitor.isNativePlatform()) await NativeApp.minimizeApp();
  }, [keyboard, loc.pathname, loc.search, nav]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];
    const register = async () => {
      const listeners = await Promise.all([
        NativeApp.addListener("backButton", () => {
          void goBack();
        }),
        Keyboard.addListener("keyboardDidShow", () => setKeyboard(true)),
        Keyboard.addListener("keyboardDidHide", () => setKeyboard(false)),
      ]);
      if (cancelled) listeners.forEach((h) => void h.remove());
      else handles.push(...listeners);
    };
    void register();
    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, [goBack]);
  useEffect(() => {
    if (Capacitor.isNativePlatform())
      void SystemBars.setStyle({ style: SystemBarsStyle.Light });
  }, []);
  const logout = () => {
    setToken(null);
    saveUser(null);
    setUser(null);
    setVisited(new Set(["/"]));
    nav("/login", { replace: true });
  };
  if (loading)
    return (
      <div className="app-frame">
        <div className="screen-scroll">
          <LoadingState />
        </div>
      </div>
    );
  if (!session)
    return (
      <div className="app-frame">
        <Auth
          onAuthed={(u) => {
            setUser(u);
            nav("/", { replace: true });
          }}
        />
      </div>
    );
  const config = SCREENS[loc.pathname];
  if (!config) return <Navigate to="/" replace />;
  const initial = String(user?.display_name || user?.email || "A")
    .slice(0, 1)
    .toUpperCase();
  const pages: Record<string, React.ReactNode> = {
    "/": <Dashboard user={user} />,
    "/calendar": <Calendar />,
    "/ai": <AICopilot active={loc.pathname === "/ai"} />,
    "/finance": <Finance />,
    "/space": <Space />,
    "/profile": <Profile user={user} onLogout={logout} />,
    "/workout": <Workout />,
    "/habits": <Habits />,
    "/notes": <Notes />,
  };
  return (
    <FeedbackProvider>
      <div className={`app-frame ${keyboard ? "keyboard-open" : ""}`}>
        <header className="app-bar">
          {config.parent && (
            <IconButton
              icon="arrow_back"
              label="Kembali"
              onClick={() => void goBack()}
            />
          )}
          <div className="bar-copy">
            <h1>{config.title}</h1>
            {loc.pathname === "/" && (
              <small>
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </small>
            )}
          </div>
          {!config.parent && (
            <button
              type="button"
              className="avatar"
              aria-label="Buka profil"
              onClick={() => {
                profileOrigin.current = loc.pathname;
                nav("/profile");
              }}
            >
              {initial}
            </button>
          )}
        </header>
        <div className="workspace">
          <main className="screens" id="main-content">
            {Object.entries(pages)
              .filter(([path]) => visited.has(path) || path === loc.pathname)
              .map(([path, page]) => (
                <div
                  key={path}
                  className="screen"
                  hidden={path !== loc.pathname}
                  data-screen={path}
                >
                  {page}
                </div>
              ))}
          </main>
          {!config.parent && !keyboard && (
            <nav className="bottom-nav" aria-label="Navigasi utama">
              {TABS.map(([path, item]) => (
                <NavLink
                  key={path}
                  end={path === "/"}
                  to={path}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <span className="nav-indicator">
                    <Icon name={item.icon!} />
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </div>
    </FeedbackProvider>
  );
}
