import { test as base, expect, type Page } from "@playwright/test";
type Write = { table: string; method: string; body: any };
type Mock = {
  writes: Write[];
  tables: Record<string, any[]>;
  fail: Set<string>;
};
export async function mockAPI(page: Page, authed = true): Promise<Mock> {
  const mock: Mock = {
    writes: [],
    fail: new Set(),
    tables: {
      events: [
        {
          id: "event-1",
          title: "Rapat tim",
          start_time: "2026-10-17T02:00:00Z",
          end_time: "2026-10-17T03:00:00Z",
        },
      ],
      priorities: Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        title: `Prioritas ${i + 1}`,
        is_done: false,
      })),
      habits: [
        {
          id: "habit-1",
          name: "Minum air",
          frequency: "daily",
          target_value: 2,
        },
      ],
      habit_logs: [],
      transactions: [
        {
          id: "tx-1",
          type: "expense",
          category: "food",
          amount: 25000,
          note: "Makan siang",
          occurred_at: "2026-10-17T05:00:00Z",
        },
      ],
      budgets: [],
      workout_plans: [
        { id: "plan-1", name: "Push A", split_type: "push", day_of_week: [6] },
        { id: "plan-2", name: "Pull B", split_type: "pull", day_of_week: [1] },
      ],
      workout_logs: [],
      workout_sets: [],
      notes: [
        {
          id: "note-1",
          title: "Ide pertama",
          content:
            "Baris pertama\nBaris kedua\nBaris ketiga yang tetap ada pada detail",
          updated_at: "2026-10-17T03:00:00Z",
        },
      ],
      morning_briefs: [
        { id: "brief", content: "Ringkasan harian. ".repeat(30) },
      ],
      ai_conversations: [{ id: "conv-1" }],
      ai_messages: [
        {
          id: "m-1",
          role: "assistant",
          content: "Halo, ada yang bisa dibantu?",
        },
      ],
    },
  };
  await page.clock.setFixedTime(new Date("2026-10-17T05:00:00Z"));
  await page.addInitScript(
    ({ authed }) => {
      if (authed) {
        localStorage.setItem("east3_token", "test-token");
        localStorage.setItem(
          "east3_user",
          JSON.stringify({
            id: "user",
            display_name: "Seva",
            email: "seva@example.test",
          }),
        );
      }
    },
    { authed },
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const body = req.postDataJSON();
    const part = url.pathname.split("/").filter(Boolean);
    const table = part[2] || "";
    const id = part[3];
    const json = (data: any, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (mock.fail.has(table) || mock.fail.has(url.pathname))
      return json({ error: "Layanan sedang tidak tersedia" }, 503);
    if (url.pathname === "/api/auth/me")
      return json({
        user: { id: "user", display_name: "Seva", email: "seva@example.test" },
      });
    if (url.pathname.startsWith("/api/auth/"))
      return json({
        token: "test-token",
        user: { id: "user", display_name: "Seva", email: "seva@example.test" },
      });
    if (url.pathname === "/api/ai-proxy") {
      mock.writes.push({ table: "ai", method, body });
      if (body.action === "search_notes")
        return json({ results: mock.tables.notes });
      if (body.action === "morning_brief")
        return json({ brief: "Hari yang menyenangkan." });
      return json({ reply: "Sudah saya bantu." });
    }
    if (method === "GET") {
      let rows = [...(mock.tables[table] || [])];
      for (const [key, value] of url.searchParams) {
        if (key.startsWith("filter_eq_")) {
          const field = key.slice(10);
          rows = rows.filter(
            (r) => String(r[field]) === value || r[field] === undefined,
          );
        }
      }
      return json({ data: rows, has_more: false });
    }
    mock.writes.push({ table, method, body });
    if (id === "upsert") {
      const keys = body.on_conflict
        .split(",")
        .filter((key: string) => key !== "user_id");
      const current = (mock.tables[table] || []).find((row) =>
        keys.every((key: string) => row[key] === body.row[key]),
      );
      if (current) {
        Object.assign(current, body.row);
        return json({ data: current });
      }
    }
    if (method === "DELETE") {
      mock.tables[table] = (mock.tables[table] || []).filter(
        (r) => r.id !== id,
      );
      return json({ ok: true });
    }
    if (method === "PATCH") {
      const row = (mock.tables[table] || []).find((r) => r.id === id);
      Object.assign(row || {}, body);
      return json({ data: row });
    }
    const row = { ...(body?.row || body), id: `new-${mock.writes.length}` };
    (mock.tables[table] ||= []).push(row);
    return json({ data: row });
  });
  return mock;
}
export const test = base.extend<{ mock: Mock }>({
  mock: async ({ page }, use) => {
    await use(await mockAPI(page));
  },
});
export { expect };
