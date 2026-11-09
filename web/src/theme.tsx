import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

type ThemePreference = "dark" | "light" | "system";
type Theme = "dark" | "light";
const STORAGE_KEY = "east3_theme";
const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

function parsePreference(value: string | null): ThemePreference {
  return value === "light" || value === "system" ? value : "dark";
}

function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "dark";
  }
}

function resolveTheme(preference: ThemePreference): Theme {
  return preference === "system"
    ? window.matchMedia(SYSTEM_QUERY).matches
      ? "dark"
      : "light"
    : preference;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#101722" : "#f8f9fd");
}

// Apply the saved appearance before React renders the app shell.
export function initializeTheme() {
  applyTheme(resolveTheme(readPreference()));
}

const ThemeContext = createContext<{
  preference: ThemePreference;
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
}>({ preference: "dark", theme: "dark", setPreference: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(SYSTEM_QUERY).matches,
  );
  const theme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_QUERY);
    const update = () => setSystemDark(media.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null)
        setPreferenceState(readPreference());
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useLayoutEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void SystemBars.setStyle({
        style: theme === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => {});
    }
  }, [theme]);

  const setPreference = (next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The appearance can still change when storage is unavailable.
    }
    setPreferenceState(next);
  };

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
