import { query, queryOne, transaction, type SQL } from "./_db";
import {
  DEFAULT_PROFILE,
  SHIFT_TYPES,
  WORKOUT_TEMPLATES,
  buildDailyPlan,
  dayAdd,
  localDay,
  shiftTimes,
  validDay,
} from "../shared/life";

export class LifeError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
const numeric: Record<string, [number, number]> = {
  height_cm: [50, 250],
  weight_kg: [20, 350],
  target_weight_kg: [20, 350],
  age: [1, 120],
  calorie_target: [500, 6000],
  protein_target: [10, 300],
  meals_target: [2, 6],
  sleep_hours: [6, 10],
  commute_minutes: [0, 180],
  handover_minutes: [0, 120],
  workout_weekly: [1, 5],
  workout_minutes: [10, 90],
};
const integers = [
  "age",
  "calorie_target",
  "meals_target",
  "commute_minutes",
  "handover_minutes",
  "workout_weekly",
  "workout_minutes",
];
export function validateProfile(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LifeError("Profil tidak valid.");
  const out: any = {};
  for (const [key, raw] of Object.entries(value)) {
    if (numeric[key]) {
      if (
        raw === null &&
        [
          "height_cm",
          "weight_kg",
          "target_weight_kg",
          "age",
          "calorie_target",
          "protein_target",
        ].includes(key)
      ) {
        out[key] = null;
        continue;
      }
      const n = Number(raw),
        [min, max] = numeric[key];
      if (
        raw === "" ||
        raw === null ||
        typeof raw === "boolean" ||
        !Number.isFinite(n) ||
        n < min ||
        n > max ||
        (integers.includes(key) && !Number.isInteger(n))
      )
        throw new LifeError(`Nilai ${key} tidak valid.`);
      out[key] = n;
    } else if (["wake_time", "bed_time"].includes(key)) {
      if (typeof raw !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw))
        throw new LifeError("Jam tidur/bangun tidak valid.");
      out[key] = raw;
    } else if (key === "preferences") {
      if (typeof raw !== "string" || raw.length > 4000)
        throw new LifeError("Preferensi maksimal 4.000 karakter.");
      out[key] = raw;
    } else if (key === "reminders_enabled" && typeof raw === "boolean")
      out[key] = raw;
    else throw new LifeError(`Kolom profil tidak dikenal: ${key}`);
  }
  if (!Object.keys(out).length)
    throw new LifeError("Belum ada perubahan profil.");
  return out;
}
export function normalizeShiftRows(value: any, timezone: string) {
  if (!Array.isArray(value) || !value.length || value.length > 62)
    throw new LifeError("Isi 1–62 tanggal shift.");
  const dates = new Set<string>();
  return value.map((row) => {
    if (
      !row ||
      !validDay(row.date) ||
      !Object.hasOwn(SHIFT_TYPES, row.code) ||
      dates.has(row.date)
    )
      throw new LifeError("Tanggal/kode shift tidak valid atau tanggal ganda.");
    dates.add(row.date);
    return {
      date: row.date,
      code: row.code,
      ...shiftTimes(row.date, row.code, timezone),
      agent: typeof row.agent === "string" ? row.agent.slice(0, 100) : "",
    };
  });
}
export function validateWellness(value: any, timezone: string) {
  const kind = value?.kind;
  if (!["meal", "weight", "sleep", "energy"].includes(kind))
    throw new LifeError("Jenis catatan tidak valid.");
  const date = value.date ?? localDay(new Date(), timezone);
  if (!validDay(date)) throw new LifeError("Tanggal catatan tidak valid.");
  const row: any = {
    kind,
    date,
    description: String(value.description || "")
      .trim()
      .slice(0, 1000),
    is_estimate: kind === "meal" ? value.is_estimate !== false : false,
  };
  const ranges: Record<string, [number, number]> =
    kind === "meal"
      ? { calories: [0, 10000], protein_g: [0, 500] }
      : kind === "weight"
        ? { weight_kg: [20, 350] }
        : kind === "sleep"
          ? { sleep_hours: [0, 24] }
          : { energy: [1, 5] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (value[key] == null && kind === "meal") continue;
    const n = Number(value[key]);
    if (
      value[key] == null ||
      value[key] === "" ||
      typeof value[key] === "boolean" ||
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (key === "energy" && !Number.isInteger(n))
    )
      throw new LifeError(`Nilai ${key} tidak valid.`);
    row[key] = n;
  }
  if (kind === "meal" && !row.description)
    throw new LifeError("Ceritakan makanan yang dimakan.");
  if (value.logged_at !== undefined) {
    const instant = new Date(value.logged_at);
    if (
      !Number.isFinite(instant.getTime()) ||
      localDay(instant, timezone) !== date
    )
      throw new LifeError(
        "Jam catatan harus berada pada tanggal lokal yang dipilih.",
      );
    row.logged_at = instant.toISOString();
  }
  return row;
}

export async function getLifeContext(
  userId: string,
  timezone: string,
  date = localDay(new Date(), timezone),
) {
  if (!validDay(date)) throw new LifeError("Tanggal tidak valid.");
  const [
    profileRow,
    shifts,
    logs,
    tasks,
    events,
    workouts,
    states,
    programs,
    lastWeight,
  ] = await Promise.all([
    queryOne("SELECT * FROM health_profiles WHERE user_id = $1", [userId]),
    query(
      "SELECT * FROM shift_assignments WHERE user_id = $1 AND date >= $2::date AND date <= $3::date ORDER BY date",
      [userId, dayAdd(date, -1), dayAdd(date, 7)],
    ),
    query(
      "SELECT * FROM wellness_logs WHERE user_id = $1 AND date >= $2::date AND date <= $3::date ORDER BY logged_at, id",
      [userId, dayAdd(date, -30), date],
    ),
    query(
      "SELECT * FROM priorities WHERE user_id = $1 AND date <= $2::date AND is_done = false ORDER BY due_date NULLS LAST, date, created_at LIMIT 100",
      [userId, date],
    ),
    query(
      "SELECT * FROM events WHERE user_id = $1 AND end_time > ($2::date - INTERVAL '2 days') AND start_time < ($2::date + INTERVAL '3 days')",
      [userId, date],
    ),
    query(
      "SELECT * FROM workout_logs WHERE user_id = $1 AND date >= $2::date AND date <= $3::date ORDER BY date",
      [userId, dayAdd(date, -30), date],
    ),
    query(
      "SELECT * FROM daily_plan_states WHERE user_id = $1 AND date = $2::date",
      [userId, date],
    ),
    query(
      "SELECT * FROM workout_plans WHERE user_id = $1 ORDER BY created_at, id",
      [userId],
    ),
    queryOne(
      "SELECT weight_kg FROM wellness_logs WHERE user_id = $1 AND kind = 'weight' AND date <= $2::date ORDER BY date DESC, logged_at DESC, id DESC LIMIT 1",
      [userId, date],
    ),
  ]);
  const profile = { ...DEFAULT_PROFILE, ...profileRow };
  const plan = buildDailyPlan({
    date,
    timezone,
    profile,
    shifts,
    logs,
    tasks,
    events,
    workouts,
    programs,
  });
  const stateMap = new Map(states.map((s) => [s.item_key, s]));
  let items = plan.items.map((item) => {
    const state = stateMap.get(item.key);
    if (!state) return { ...item, status: "planned" };
    if (state.status === "snoozed") {
      const start = Date.parse(state.snoozed_until),
        duration = Date.parse(item.end_time) - Date.parse(item.start_time);
      const conflict =
        !item.flexible &&
        plan.busy.some(
          (b) =>
            start < Date.parse(b.end_time) &&
            start + duration > Date.parse(b.start_time),
        );
      if (!conflict)
        return {
          ...item,
          start_time: new Date(start).toISOString(),
          end_time: new Date(start + duration).toISOString(),
          status: "snoozed",
        };
      return { ...item, status: "planned" };
    }
    return { ...state.item, status: state.status };
  });
  for (const state of states)
    if (
      state.status !== "snoozed" &&
      !items.some((i) => i.key === state.item_key)
    )
      items.push({ ...state.item, status: state.status });
  items.sort((a, b) => a.start_time.localeCompare(b.start_time));
  const todayLogs = logs.filter((l) => l.date === date);
  const meals = todayLogs.filter((l) => l.kind === "meal");
  let unlinkedMeals = Math.max(
    0,
    meals.length -
      states.filter((s) => s.status === "done" && s.item?.kind === "meal")
        .length,
  );
  items = items.map((item) =>
    item.kind === "meal" &&
    !["done", "skipped"].includes(item.status) &&
    unlinkedMeals-- > 0
      ? {
          ...item,
          status: "done",
          note: "Makanan sudah dicatat lewat chat atau Kesehatan.",
        }
      : item,
  );
  const weights = logs.filter((l) => l.kind === "weight");
  const latestWeight =
    lastWeight?.weight_kg ??
    weights.at(-1)?.weight_kg ??
    profile.weight_kg ??
    null;
  return {
    date,
    timezone,
    profile,
    has_profile: !!profileRow,
    shifts,
    logs,
    tasks,
    events,
    workouts,
    programs,
    plan: { ...plan, items },
    progress: {
      meals: meals.length,
      calories: meals.reduce((s, m) => s + Number(m.calories || 0), 0),
      protein_g: meals.reduce((s, m) => s + Number(m.protein_g || 0), 0),
      unestimated_meals: meals.filter((m) => m.calories == null).length,
      weight_kg: latestWeight,
      weight_change:
        weights.length > 1
          ? Number(weights.at(-1).weight_kg) - Number(weights[0].weight_kg)
          : null,
      sleep_hours:
        todayLogs.filter((l) => l.kind === "sleep").at(-1)?.sleep_hours ?? null,
      workouts_week: new Set(
        workouts.filter((w) => w.date >= dayAdd(date, -6)).map((w) => w.date),
      ).size,
    },
    weekly: Array.from({ length: 7 }, (_, i) => {
      const day = dayAdd(date, -6 + i);
      return {
        date: day,
        meals: logs.filter((l) => l.date === day && l.kind === "meal").length,
        workout: workouts.some((w) => w.date === day),
      };
    }),
  };
}

type Change = { table: string; id: string; before: any; after: any };
const undoTables = new Set([
  "health_profiles",
  "shift_assignments",
  "wellness_logs",
  "priorities",
  "events",
  "workout_plans",
  "workout_logs",
  "daily_plan_states",
  "transactions",
]);
async function write(
  sql: SQL,
  table: string,
  row: any,
  userId: string,
  id?: string,
  conflict?: string,
): Promise<Change> {
  if (!undoTables.has(table)) throw new LifeError("Aksi tidak dikenal.");
  const before = id
    ? (
        await sql(
          `SELECT * FROM ${table} WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [id, userId],
        )
      )[0]
    : conflict
      ? (
          await sql(
            `SELECT * FROM ${table} WHERE user_id = $1 ${conflict === "date" ? "AND date = $2::date" : ""} FOR UPDATE`,
            conflict === "date" ? [userId, row.date] : [userId],
          )
        )[0]
      : null;
  if (id && !before) throw new LifeError("Catatan tidak ditemukan.", 404);
  const keys = Object.keys(row),
    values = keys.map((k) =>
      k === "exercises" ||
      (typeof row[k] === "object" && row[k] !== null && !Array.isArray(row[k]))
        ? JSON.stringify(row[k])
        : row[k],
    );
  let after: any;
  if (before)
    after = (
      await sql(
        `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")} WHERE id = $${values.length + 1} AND user_id = $${values.length + 2} RETURNING *`,
        [...values, before.id, userId],
      )
    )[0];
  else
    after = (
      await sql(
        `INSERT INTO ${table} (user_id, ${keys.join(", ")}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")}) RETURNING *`,
        [userId, ...values],
      )
    )[0];
  return { table, id: after.id, before: before || null, after };
}
async function audit(
  sql: SQL,
  userId: string,
  tool: string,
  params: any,
  changes: Change[],
  message: string,
) {
  const result = { success: true, message, undo: changes };
  const [action] = await sql(
    "INSERT INTO ai_action_logs (user_id, tool_name, params, result, model_used) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      userId,
      tool,
      JSON.stringify(params),
      JSON.stringify(result),
      "atlas-life",
    ],
  );
  await sql("DELETE FROM morning_briefs WHERE user_id = $1", [userId]);
  return {
    success: true,
    message,
    action_id: action.id,
    can_undo: changes.length > 0,
  };
}
export async function undoLifeAction(userId: string, id: string) {
  return transaction(async (sql) => {
    await sql("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const [action] = await sql(
      "SELECT * FROM ai_action_logs WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, userId],
    );
    if (!action || action.is_undone || !Array.isArray(action.result?.undo))
      throw new LifeError("Aksi tidak dapat dibatalkan.", 409);
    for (const change of [...action.result.undo].reverse() as Change[]) {
      if (!undoTables.has(change.table))
        throw new LifeError("Aksi tidak dapat dibatalkan.");
      const [current] = await sql(
        `SELECT * FROM ${change.table} WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [change.id, userId],
      );
      if (
        !current ||
        Object.keys(change.after).some(
          (k) => JSON.stringify(current[k]) !== JSON.stringify(change.after[k]),
        )
      )
        throw new LifeError(
          "Data sudah berubah setelah aksi ini. Ubah catatan terbaru terlebih dahulu.",
          409,
        );
      if (change.before) {
        const keys = Object.keys(change.before).filter(
          (k) => !["id", "user_id", "created_at"].includes(k),
        );
        await sql(
          `UPDATE ${change.table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
          [
            ...keys.map((k) =>
              typeof change.before[k] === "object" && change.before[k] !== null
                ? JSON.stringify(change.before[k])
                : change.before[k],
            ),
            change.id,
            userId,
          ],
        );
      } else
        await sql(
          `DELETE FROM ${change.table} WHERE id = $1 AND user_id = $2`,
          [change.id, userId],
        );
    }
    await sql(
      "UPDATE ai_action_logs SET is_undone = true WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    await sql("DELETE FROM morning_briefs WHERE user_id = $1", [userId]);
    return { success: true, message: "Aksi dibatalkan." };
  });
}

export async function executeLifeTool(
  name: string,
  params: any,
  userId: string,
  timezone: string,
): Promise<any> {
  const today = localDay(new Date(), timezone);
  if (name === "get_life_context")
    return getLifeContext(userId, timezone, params.date || today);
  if (name === "preview_shift_import") {
    if (
      !Array.isArray(params.rows) ||
      !params.rows.length ||
      params.rows.length > 62 ||
      params.rows.some(
        (row: any) =>
          !validDay(row?.date) ||
          (row.code !== null && !Object.hasOwn(SHIFT_TYPES, row.code)),
      ) ||
      new Set(params.rows.map((r: any) => r.date)).size !== params.rows.length
    )
      throw new LifeError("Pratinjau jadwal tidak valid.");
    const rows = params.rows.map((row: any) => ({
      date: row.date,
      code: row.code,
    }));
    return {
      success: true,
      message: "Pratinjau shift siap diperiksa. Belum disimpan.",
      draft: {
        rows,
        agent: params.agent || "",
        warnings: Array.isArray(params.warnings)
          ? params.warnings.map(String).slice(0, 62)
          : [],
      },
    };
  }
  if (name === "undo_life_action")
    return undoLifeAction(userId, String(params.action_id));
  // All mutations and their undo records commit together, serialized per account.
  return transaction(async (sql) => {
    await sql("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const changes: Change[] = [];
    let message = "";
    if (name === "create_event") {
      const start = new Date(params.start_time),
        end = new Date(params.end_time);
      if (
        !String(params.title || "").trim() ||
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        end <= start
      )
        throw new LifeError("Judul atau waktu acara tidak valid.");
      changes.push(
        await write(
          sql,
          "events",
          {
            title: String(params.title).slice(0, 500),
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            recurrence_rule: params.recurrence_rule || null,
            color: /^#[a-fA-F0-9]{6}$/.test(params.color)
              ? params.color
              : "#088395",
            source: "ai",
          },
          userId,
        ),
      );
      message = `Acara “${params.title}” disimpan.`;
    } else if (name === "create_priority") {
      const date = params.date || today,
        duration = params.duration_minutes ?? 15;
      if (
        !String(params.title || "").trim() ||
        !validDay(date) ||
        !Number.isInteger(duration) ||
        duration < 5 ||
        duration > 240 ||
        (params.due_date &&
          (!validDay(params.due_date) || params.due_date < date)) ||
        (params.energy && !["low", "medium", "high"].includes(params.energy))
      )
        throw new LifeError("Judul, durasi, atau tanggal tugas tidak valid.");
      changes.push(
        await write(
          sql,
          "priorities",
          {
            title: String(params.title).slice(0, 500),
            date,
            duration_minutes: duration,
            due_date: params.due_date || null,
            energy: params.energy || "low",
            is_fixed: params.is_fixed === true,
          },
          userId,
        ),
      );
      message = `Tugas “${params.title}” disimpan.`;
    } else if (name === "log_transaction") {
      const categories = [
        "food",
        "transport",
        "shopping",
        "health",
        "entertainment",
        "education",
        "utilities",
        "gym",
        "investment",
        "salary",
        "freelance",
        "other",
      ];
      if (
        typeof params.amount !== "number" ||
        !Number.isFinite(params.amount) ||
        params.amount <= 0 ||
        params.amount > 9999999999999.99 ||
        !["income", "expense"].includes(params.type) ||
        (params.date && !validDay(params.date))
      )
        throw new LifeError("Transaksi tidak valid.");
      changes.push(
        await write(
          sql,
          "transactions",
          {
            amount: params.amount,
            type: params.type,
            category: categories.includes(params.category)
              ? params.category
              : "other",
            note: String(params.note || "").slice(0, 1000),
            occurred_at: params.date
              ? shiftTimes(params.date, "2", timezone).start_time
              : new Date().toISOString(),
            source: "ai",
          },
          userId,
        ),
      );
      message = `Transaksi Rp ${params.amount.toLocaleString("id-ID")} dicatat.`;
    } else if (name === "create_workout_plan") {
      const exercises = params.exercises || WORKOUT_TEMPLATES[0].exercises;
      if (
        !String(params.name || "").trim() ||
        !Array.isArray(exercises) ||
        !exercises.length ||
        exercises.length > 20 ||
        exercises.some(
          (e: any) =>
            !e.name ||
            !Number.isInteger(e.defaultSets) ||
            e.defaultSets < 1 ||
            e.defaultSets > 10 ||
            !Number.isInteger(e.defaultReps) ||
            e.defaultReps < 1 ||
            e.defaultReps > 100,
        ) ||
        (params.day_of_week &&
          (!Array.isArray(params.day_of_week) ||
            params.day_of_week.some(
              (d: any) => !Number.isInteger(d) || d < 0 || d > 6,
            )))
      )
        throw new LifeError("Program latihan tidak valid.");
      changes.push(
        await write(
          sql,
          "workout_plans",
          {
            name: String(params.name).slice(0, 200),
            split_type: params.split_type || "full_body",
            day_of_week: params.day_of_week || [],
            exercises,
            schedule_mode: params.schedule_mode || "flexible",
          },
          userId,
        ),
      );
      message = `Program “${params.name}” beserta gerakan disimpan.`;
    } else if (name === "update_health_profile") {
      changes.push(
        await write(
          sql,
          "health_profiles",
          validateProfile(params),
          userId,
          undefined,
          "user",
        ),
      );
      message = "Profil dan preferensi diperbarui.";
    } else if (name === "log_wellness") {
      changes.push(
        await write(
          sql,
          "wellness_logs",
          validateWellness(params, timezone),
          userId,
          params.id,
        ),
      );
      message =
        (
          {
            meal: "Makanan",
            weight: "Berat badan",
            sleep: "Tidur",
            energy: "Energi",
          } as any
        )[params.kind] + " dicatat.";
    } else if (name === "repeat_meal") {
      const [meal] = await sql(
        "SELECT * FROM wellness_logs WHERE id = $1 AND user_id = $2 AND kind = 'meal'",
        [params.id, userId],
      );
      if (!meal)
        throw new LifeError("Makanan sebelumnya tidak ditemukan.", 404);
      const { description, calories, protein_g, is_estimate } = meal;
      changes.push(
        await write(
          sql,
          "wellness_logs",
          validateWellness(
            {
              kind: "meal",
              date: params.date || today,
              description,
              calories,
              protein_g,
              is_estimate,
            },
            timezone,
          ),
          userId,
        ),
      );
      message = "Makanan yang sama dicatat untuk hari ini.";
    } else if (name === "save_shift_import" || name === "change_shift") {
      const rows = normalizeShiftRows(
        name === "change_shift" ? [params] : params.rows,
        timezone,
      );
      for (const row of rows)
        changes.push(
          await write(sql, "shift_assignments", row, userId, undefined, "date"),
        );
      message = `${rows.length} tanggal shift disimpan. Rencana harian menyesuaikan jadwal terbaru.`;
    } else if (name === "update_task") {
      const matches = params.id
        ? await sql("SELECT * FROM priorities WHERE id = $1 AND user_id = $2", [
            params.id,
            userId,
          ])
        : await sql(
            "SELECT * FROM priorities WHERE title = $1 AND user_id = $2 AND is_done = false LIMIT 2",
            [params.title, userId],
          );
      if (matches.length > 1)
        throw new LifeError(
          "Ada beberapa tugas dengan judul sama. Pilih ID tugas yang dimaksud.",
        );
      const task = matches[0];
      if (!task)
        throw new LifeError(
          "Tugas tidak ditemukan. Gunakan ID dari rencana harian.",
          404,
        );
      const row: any = {};
      if (params.date !== undefined) {
        if (
          !validDay(params.date) ||
          (task.is_fixed && params.date !== task.date) ||
          (task.due_date && params.date > task.due_date)
        )
          throw new LifeError(
            "Tanggal melewati tenggat atau tugas memiliki jadwal tetap.",
          );
        row.date = params.date;
      }
      if (params.is_done !== undefined) {
        if (typeof params.is_done !== "boolean")
          throw new LifeError("Status tugas tidak valid.");
        row.is_done = params.is_done;
      }
      if (!Object.keys(row).length)
        throw new LifeError("Tentukan perubahan tugas.");
      changes.push(await write(sql, "priorities", row, userId, task.id));
      message = "Tugas diperbarui.";
    } else if (name === "reschedule_event") {
      const start = new Date(params.start_time),
        end = new Date(params.end_time);
      if (
        !params.id ||
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        end <= start
      )
        throw new LifeError("Waktu acara tidak valid.");
      const conflicts = await sql(
        "SELECT id FROM shift_assignments WHERE user_id = $1 AND start_time < $3 AND end_time > $2 UNION ALL SELECT id FROM events WHERE user_id = $1 AND id <> $4 AND start_time < $3 AND end_time > $2",
        [userId, start.toISOString(), end.toISOString(), params.id],
      );
      if (conflicts.length)
        throw new LifeError(
          "Waktu baru bertabrakan dengan shift atau acara lain.",
        );
      changes.push(
        await write(
          sql,
          "events",
          { start_time: start.toISOString(), end_time: end.toISOString() },
          userId,
          params.id,
        ),
      );
      message = "Acara dipindahkan.";
    } else throw new LifeError("Aksi tidak dikenal.");
    return audit(sql, userId, name, params, changes, message);
  });
}

export async function setPlanState(
  userId: string,
  timezone: string,
  params: any,
) {
  if (
    !validDay(params.date) ||
    !["done", "skipped", "snoozed"].includes(params.status)
  )
    throw new LifeError("Status rencana tidak valid.");
  const context = await getLifeContext(userId, timezone, params.date);
  const item = context.plan.items.find((i) => i.key === params.key);
  if (!item || item.kind === "sleep")
    throw new LifeError("Aktivitas tidak ditemukan.");
  if (["done", "skipped"].includes(item.status))
    return { success: true, message: "Aktivitas sudah dicatat." };
  let snoozed: string | null = null;
  if (params.status === "snoozed") {
    const start =
      Math.max(Date.now(), Date.parse(item.start_time)) + 30 * 60000;
    const duration = Date.parse(item.end_time) - Date.parse(item.start_time);
    if (
      localDay(new Date(start + duration), timezone) !== params.date ||
      context.plan.busy.some(
        (b) =>
          start < Date.parse(b.end_time) &&
          start + duration > Date.parse(b.start_time),
      ) ||
      context.plan.items.some(
        (i) =>
          i.key !== item.key &&
          i.status !== "skipped" &&
          start < Date.parse(i.end_time) &&
          start + duration > Date.parse(i.start_time),
      )
    )
      throw new LifeError(
        "Penundaan 30 menit bertabrakan dengan jadwal. Pilih waktu lain lewat chat.",
      );
    snoozed = new Date(start).toISOString();
  }
  return transaction(async (sql) => {
    await sql("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const [existing] = await sql(
      "SELECT * FROM daily_plan_states WHERE user_id = $1 AND date = $2 AND item_key = $3 FOR UPDATE",
      [userId, params.date, params.key],
    );
    if (existing && ["done", "skipped"].includes(existing.status))
      return { success: true, message: "Aktivitas sudah dicatat." };
    const changes: Change[] = [];
    if (params.status === "done") {
      if (item.kind === "meal")
        changes.push(
          await write(
            sql,
            "wellness_logs",
            validateWellness(
              { kind: "meal", date: params.date, description: item.title },
              timezone,
            ),
            userId,
          ),
        );
      if (item.kind === "workout")
        changes.push(
          await write(
            sql,
            "workout_logs",
            {
              date: params.date,
              duration_minutes: Math.round(
                (Date.parse(item.end_time) - Date.parse(item.start_time)) /
                  60000,
              ),
              notes: item.title,
            },
            userId,
          ),
        );
      if (item.task_id)
        changes.push(
          await write(
            sql,
            "priorities",
            { is_done: true },
            userId,
            item.task_id,
          ),
        );
    }
    changes.push(
      await write(
        sql,
        "daily_plan_states",
        {
          date: params.date,
          item_key: item.key,
          status: params.status,
          snoozed_until: snoozed,
          item,
        },
        userId,
        existing?.id,
      ),
    );
    return audit(
      sql,
      userId,
      "plan_state",
      params,
      changes,
      params.status === "done"
        ? "Aktivitas selesai dicatat."
        : params.status === "skipped"
          ? "Aktivitas dilewati."
          : "Pengingat ditunda 30 menit.",
    );
  });
}

const field = (type: string, description: string, extra = {}) => ({
  type,
  description,
  ...extra,
});
const tool = (
  name: string,
  description: string,
  properties: any,
  required: string[] = [],
) => ({
  name,
  description,
  parameters: { type: "object", properties, required },
});
export const LIFE_TOOLS = [
  tool(
    "get_life_context",
    "Membaca profil, shift, kesehatan, ID tugas, dan rencana harian. Gunakan sebelum menyusun atau mengubah rencana.",
    { date: field("string", "YYYY-MM-DD, opsional") },
  ),
  tool(
    "update_health_profile",
    "Simpan informasi dan preferensi yang dinyatakan pengguna; jangan mengarang target kalori/protein atau riwayat kesehatan.",
    Object.fromEntries([
      ...Object.keys(numeric).map((k) => [k, field("number", k)]),
      ["wake_time", field("string", "HH:mm")],
      ["bed_time", field("string", "HH:mm")],
      [
        "preferences",
        field("string", "Preferensi lengkap; pertahankan informasi sebelumnya"),
      ],
      ["reminders_enabled", field("boolean", "Pengingat diaktifkan pengguna")],
    ]),
  ),
  tool(
    "log_wellness",
    "Catat atau ubah makanan, berat, tidur, energi. Satu tool per jenis. Kalori/protein estimasi harus masuk akal dan berlabel estimasi; boleh kosong bila porsi tidak diketahui.",
    {
      kind: field("string", "Jenis", {
        enum: ["meal", "weight", "sleep", "energy"],
      }),
      date: field("string", "Tanggal lokal YYYY-MM-DD"),
      description: field("string", "Makanan/porsi atau catatan"),
      calories: field("number", "Kalori estimasi opsional"),
      protein_g: field("number", "Protein gram estimasi opsional"),
      weight_kg: field("number", "Berat kg"),
      sleep_hours: field("number", "Durasi jam"),
      energy: field("integer", "1 sangat lelah sampai 5 bugar"),
      is_estimate: field("boolean", "true kecuali nilai terukur diberikan"),
      id: field("string", "ID catatan untuk koreksi, opsional"),
    },
    ["kind"],
  ),
  tool(
    "preview_shift_import",
    "Baca jadwal foto menjadi PRATINJAU; belum menyimpan. Hanya baris orang yang diminta. Jangan menebak sel buram. Masukkan peringatan dan tanggal yang perlu diperiksa.",
    {
      agent: field("string", "Nama baris"),
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: field("string", "YYYY-MM-DD"),
            code: {
              type: ["string", "null"],
              description: "Kode; null jika sel belum terbaca",
              enum: [...Object.keys(SHIFT_TYPES), null],
            },
            agent: field("string", "Nama orang"),
          },
          required: ["date", "code"],
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
    ["rows"],
  ),
  tool(
    "change_shift",
    "Ubah satu tanggal shift atas instruksi eksplisit pengguna; shift malam berakhir besok.",
    {
      date: field("string", "YYYY-MM-DD"),
      code: field("string", "Kode", { enum: Object.keys(SHIFT_TYPES) }),
    },
    ["date", "code"],
  ),
  tool(
    "update_task",
    "Tandai tugas selesai atau ubah tanggal. Hormati jadwal tetap dan tenggat.",
    {
      id: field("string", "ID tugas"),
      title: field("string", "Judul persis jika ID belum diketahui"),
      date: field("string", "Tanggal baru YYYY-MM-DD"),
      is_done: field("boolean", "Status selesai"),
    },
  ),
  tool(
    "reschedule_event",
    "Pindahkan acara yang diminta pengguna, setelah membaca agenda. Jangan memindah janji tanpa instruksi.",
    {
      id: field("string", "ID acara"),
      start_time: field("string", "ISO8601 dengan zona"),
      end_time: field("string", "ISO8601 dengan zona"),
    },
    ["id", "start_time", "end_time"],
  ),
];
