import { useEffect } from "react";
import { api, loadUser } from "./api";
import { PersonalDevice, personalNative } from "./personalDevice";
export function usePersonalReminders(userId: string | null) {
  useEffect(() => {
    if (!personalNative) return;
    let active = true,
      running = false;
    const refresh = async () => {
      if (running || !active || document.visibilityState !== "visible") return;
      if (!userId) {
        await PersonalDevice.reminders({ userId: "", items: [] }).catch(
          () => {},
        );
        return;
      }
      running = true;
      try {
        const rhythm = await api.personal("rhythm");
        if (!active || loadUser()?.id !== userId) return;
        await PersonalDevice.reminders({
          userId,
          items: rhythm.reminders || [],
        });
        if (!active || loadUser()?.id !== userId)
          await PersonalDevice.reminders({ userId: "", items: [] });
      } catch {
        /* Keep the last valid schedule when offline. */
      } finally {
        running = false;
      }
    };
    const sync = () => {
      void refresh();
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("atlas:data", sync);
    document.addEventListener("visibilitychange", sync);
    const timer = window.setInterval(sync, 30 * 60000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("atlas:data", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [userId]);
}
