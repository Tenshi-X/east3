import { useEffect, useState } from "react";
import { todayStr } from "./api";

export function useLocalDay() {
  const [day, setDay] = useState(todayStr());
  useEffect(() => {
    const refresh = () => setDay(todayStr());
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return day;
}
