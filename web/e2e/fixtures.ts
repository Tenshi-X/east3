import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { DEFAULT_PROFILE, buildDailyPlan, shiftTimes } from "../../shared/life";
type Write = { table: string; method: string; body: any };
type Mock = {
  writes: Write[];
  tables: Record<string, any[]>;
  fail: Set<string>;
};
export async function mockAPI(page: Page, authed = true): Promise<Mock> {
  // Serve a production build entirely from disk when a local server is unavailable.
  if (process.env.ATLAS_TEST_STATIC_DIR) {
    const root = resolve(process.env.ATLAS_TEST_STATIC_DIR);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/")) return route.fallback();
      const path = resolve(
        root,
        `.${url.pathname.includes(".") ? url.pathname : "/index.html"}`,
      );
      if (!path.startsWith(root + sep)) return route.fulfill({ status: 403 });
      try {
        const contentType =
          (
            {
              ".js": "text/javascript",
              ".css": "text/css",
              ".html": "text/html",
              ".svg": "image/svg+xml",
              ".png": "image/png",
              ".webmanifest": "application/manifest+json",
            } as Record<string, string>
          )[extname(path)] || "application/octet-stream";
        await route.fulfill({ body: await readFile(path), contentType });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
  }
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
      wallets: [],
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
      health_profiles: [],
      shift_assignments: [],
      wellness_logs: [],
      daily_plan_states: [],
    },
  };
  const undo = new Map<string, any>();
  const lifeContext = (date = "2026-10-17") => {
    const profile = { ...DEFAULT_PROFILE, ...mock.tables.health_profiles[0] };
    const logs = mock.tables.wellness_logs;
    const meals = logs.filter((l) => l.date === date && l.kind === "meal");
    const weights = logs.filter((l) => l.kind === "weight");
    const plan = buildDailyPlan({
      date,
      timezone: "Asia/Jakarta",
      profile,
      shifts: mock.tables.shift_assignments,
      events: mock.tables.events,
      tasks: mock.tables.priorities,
      workouts: mock.tables.workout_logs,
      logs,
      programs: mock.tables.workout_plans,
    });
    return {
      date,
      timezone: "Asia/Jakarta",
      profile,
      has_profile: !!mock.tables.health_profiles.length,
      shifts: mock.tables.shift_assignments,
      logs,
      tasks: mock.tables.priorities,
      plan: {
        ...plan,
        items: plan.items.map((i) => ({
          ...i,
          status:
            mock.tables.daily_plan_states.find(
              (s) => s.item_key === i.key && s.date === date,
            )?.status || "planned",
        })),
      },
      progress: {
        meals: meals.length,
        calories: meals.reduce((s, m) => s + Number(m.calories || 0), 0),
        protein_g: meals.reduce((s, m) => s + Number(m.protein_g || 0), 0),
        unestimated_meals: meals.filter((m) => m.calories == null).length,
        weight_kg: weights.at(-1)?.weight_kg ?? profile.weight_kg,
        weight_change: null,
        sleep_hours: logs
          .filter((l) => l.kind === "sleep" && l.date === date)
          .at(-1)?.sleep_hours,
        workouts_week: mock.tables.workout_logs.length,
      },
      weekly: [],
      workouts: mock.tables.workout_logs,
    };
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
    if (url.pathname === "/api/data/dashboard") {
      const sources: Record<string, string> = {
        events: "events",
        tasks: "priorities",
        habits: "habits",
        logs: "habit_logs",
        brief: "morning_briefs",
        tx: "transactions",
        plans: "workout_plans",
      };
      return json({
        resources: Object.fromEntries(
          Object.entries(sources).map(([key, source]) => [
            key,
            mock.fail.has(source)
              ? { data: [], error: "Layanan sedang tidak tersedia" }
              : { data: mock.tables[source] || [], error: "" },
          ]),
        ),
      });
    }
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
      if (body.action === "life") {
        if (body.op === "get") return json(lifeContext(body.params?.date));
        mock.writes.push({ table: "life", method, body });
        const params = body.params || {};
        const snapshot = structuredClone(mock.tables);
        if (body.op === "update_health_profile")
          mock.tables.health_profiles = [
            { ...mock.tables.health_profiles[0], ...params },
          ];
        if (body.op === "log_wellness") {
          const row = {
            ...params,
            id: params.id || `health-${mock.writes.length}`,
            logged_at: "2026-10-17T05:00:00Z",
          };
          const index = mock.tables.wellness_logs.findIndex(
            (l) => l.id === params.id,
          );
          if (index >= 0) mock.tables.wellness_logs[index] = row;
          else mock.tables.wellness_logs.push(row);
        }
        if (body.op === "save_shift_import" || body.op === "change_shift") {
          for (const row of body.op === "change_shift"
            ? [params]
            : params.rows) {
            mock.tables.shift_assignments =
              mock.tables.shift_assignments.filter((s) => s.date !== row.date);
            mock.tables.shift_assignments.push({
              ...row,
              ...shiftTimes(row.date, row.code, "Asia/Jakarta"),
              id: `shift-${row.date}`,
            });
          }
        }
        if (body.op === "plan_state")
          mock.tables.daily_plan_states.push({
            date: params.date,
            item_key: params.key,
            status: params.status,
          });
        if (body.op === "undo_life_action") {
          if (undo.has(params.action_id))
            mock.tables = undo.get(params.action_id);
          return json({ success: true });
        }
        const action_id = `life-action-${mock.writes.length}`;
        undo.set(action_id, snapshot);
        return json({
          success: true,
          message: "Catatan tersimpan.",
          action_id,
          can_undo: true,
        });
      }
      if (body.action === "shift_preview")
        return json({
          draft: {
            agent: body.agent,
            rows: [{ date: `${body.month}-01`, code: "3" }],
            warnings: ["Periksa hasil pembacaan foto."],
          },
        });
      mock.writes.push({ table: "ai", method, body });
      if (body.action === "search_notes")
        return json({ results: mock.tables.notes });
      if (body.action === "morning_brief")
        return json({ brief: "Hari yang menyenangkan." });
      return json({ reply: "Sudah saya bantu." });
    }
    if (method === "GET") {
      let rows = [...(mock.tables[table] || [])];
      if (table === "wallets")
        rows = rows.map((w) => ({
          ...w,
          balance:
            Number(w.opening_balance) +
            (mock.tables.transactions || [])
              .filter((t) => t.wallet_id === w.id)
              .reduce(
                (sum, t) =>
                  sum + Number(t.amount) * (t.type === "income" ? 1 : -1),
                0,
              ),
        }));
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
    if (table === "habit_logs" && id === "increment") {
      const habit = mock.tables.habits.find((h) => h.id === body.habit_id);
      if (!habit) return json({ error: "Kebiasaan tidak ditemukan" }, 404);
      let log = mock.tables.habit_logs.find(
        (l) => l.habit_id === body.habit_id && l.date === body.date,
      );
      if (!log) {
        log = {
          id: `log-${mock.writes.length}`,
          habit_id: body.habit_id,
          date: body.date,
          value: 0,
        };
        mock.tables.habit_logs.push(log);
      }
      log.value = Math.max(
        0,
        Math.round((Number(log.value) + body.delta) * 100) / 100,
      );
      log.is_completed = log.value >= Number(habit.target_value || 1);
      return json({ data: log });
    }
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
      if (
        table === "wallets" &&
        mock.tables.transactions.some((t) => t.wallet_id === id)
      )
        return json(
          {
            error:
              "Kantong masih memiliki transaksi. Pindahkan transaksinya sebelum menghapus kantong.",
          },
          409,
        );
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
