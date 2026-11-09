import { api, loadUser } from "./api";
export type Capture = {
  id: string;
  kind: string;
  date: string;
  content?: string;
  amount?: number;
  category?: string;
  value?: number;
  error?: string;
};
const key = (id: string) => `atlas:capture:${id}`;
export function pendingCaptures(id: string): Capture[] {
  const raw = localStorage.getItem(key(id));
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    if (Array.isArray(rows)) return rows;
  } catch {}
  throw new Error(
    "Antrean lokal belum dapat dibaca. Jangan hapus data aplikasi sebelum diperiksa.",
  );
}
function write(id: string, rows: Capture[]) {
  localStorage.setItem(key(id), JSON.stringify(rows));
  window.dispatchEvent(new Event("atlas:queue"));
}
let running: Promise<void> | null = null;
export async function flushCaptures(id: string) {
  if (running) return running;
  running = (async () => {
    if (!navigator.onLine) return;
    for (const row of pendingCaptures(id)) {
      if (loadUser()?.id !== id) return;
      if (row.error) continue;
      try {
        const { error, ...payload } = row;
        await api.personal("capture", payload);
        write(
          id,
          pendingCaptures(id).filter((r) => r.id !== row.id),
        );
        window.dispatchEvent(new Event("atlas:data"));
      } catch (e: any) {
        if (
          e.status >= 400 &&
          e.status < 500 &&
          e.status !== 401 &&
          e.status !== 429
        ) {
          write(
            id,
            pendingCaptures(id).map((r) =>
              r.id === row.id ? { ...r, error: e.message } : r,
            ),
          );
        } else return;
      }
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
export async function enqueueCapture(id: string, payload: Omit<Capture, "id">) {
  const rows = pendingCaptures(id);
  if (rows.length >= 100)
    throw new Error(
      "Antrean penuh. Sinkronkan atau periksa catatan yang tertunda.",
    );
  const row = { ...payload, id: crypto.randomUUID() };
  write(id, [...rows, row]);
  await flushCaptures(id);
  return pendingCaptures(id).some((r) => r.id === row.id);
}
export function discardCapture(id: string, captureId: string) {
  write(
    id,
    pendingCaptures(id).filter((r) => r.id !== captureId),
  );
}
export function retryCaptures(id: string) {
  write(
    id,
    pendingCaptures(id).map(({ error, ...r }) => r),
  );
  return flushCaptures(id);
}
