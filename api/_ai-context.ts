// Bounded, deterministic context: no extra AI calls or fabricated summaries.
export function compactHistory(rows: { role: string; content: string }[]) {
  const selected: typeof rows = [];
  let chars = 0;
  for (const row of [...rows].reverse()) {
    const content =
      row.content.length > 4000
        ? row.content.slice(0, 4000) + "\n[Pesan lama dipotong]"
        : row.content;
    if (chars + content.length > 16_000 || selected.length >= 12) break;
    selected.unshift({ role: row.role, content });
    chars += content.length;
  }
  // Avoid starting with an orphaned assistant reply after dropping old turns.
  while (selected[0]?.role === "assistant") selected.shift();
  return {
    history: selected.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    omitted: rows.length - selected.length,
  };
}

function clean(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string")
    return value.length > 800 ? value.slice(0, 800) + "[dipotong]" : value;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !["user_id", "created_at", "updated_at", "embedding"].includes(key),
        )
        .map(([key, val]) => [key, clean(val)]),
    );
  return value;
}
export function compactLifeContext(context: any) {
  const limits: Record<string, number> = {
    shifts: 10,
    tasks: 30,
    events: 30,
    recent_logs: 12,
    plan: 30,
  };
  const source: Record<string, any[]> = {
    shifts: context.shifts ?? [],
    tasks: context.tasks ?? [],
    events: context.events ?? [],
    recent_logs: (context.logs ?? [])
      .slice()
      .sort(
        (a: any, b: any) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.logged_at ?? a.created_at ?? "").localeCompare(
            String(b.logged_at ?? b.created_at ?? ""),
          ),
      )
      .reverse(),
    plan: context.plan?.items ?? [],
  };
  const result: Record<string, any> = {
    date: context.date,
    profile: clean(context.profile),
    progress: clean(context.progress),
    notice:
      "Konteks dapat dibatasi. Gunakan get_life_context untuk data lengkap atau tanggal lain; jangan menganggap data yang tidak ditampilkan tidak ada.",
    omitted: {},
  };
  for (const [key, rows] of Object.entries(source)) {
    result[key] = clean(rows.slice(0, limits[key]));
    result.omitted[key] = rows.length - result[key].length;
  }
  // Drop whole records, retaining valid JSON and complete IDs, never slice JSON.
  while (JSON.stringify(result).length > 12_000) {
    const key = Object.keys(source)
      .sort(
        (a, b) =>
          JSON.stringify(result[b]).length - JSON.stringify(result[a]).length,
      )
      .find((k) => result[k].length);
    if (!key) break;
    result[key].pop();
    result.omitted[key]++;
  }
  return result;
}
