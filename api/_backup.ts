import { transaction, type SQL } from "./_db";
import { PersonalError } from "./_personal";
import { personalPreferences } from "../shared/personal";

const parents: Record<string, [string, string]> = {
  habit_logs: ["habits", "habit_id"],
  workout_sets: ["workout_logs", "workout_log_id"],
  ai_messages: ["ai_conversations", "conversation_id"],
};
export const BACKUP_TABLES = [
  "personal_profiles",
  "personal_memories",
  "personal_projects",
  "wallets",
  "events",
  "priorities",
  "transactions",
  "budgets",
  "workout_plans",
  "workout_logs",
  "workout_sets",
  "workout_checkins",
  "habits",
  "habit_logs",
  "notes",
  "ai_conversations",
  "ai_messages",
  "ai_action_logs",
  "morning_briefs",
  "health_profiles",
  "shift_assignments",
  "wellness_logs",
  "daily_plan_states",
  "personal_bills",
  "personal_bill_payments",
  "personal_overtime",
  "personal_captures",
];
const references: Record<string, [string, string][]> = {
  ...Object.fromEntries(
    Object.entries(parents).map(([t, [parent, col]]) => [t, [[parent, col]]]),
  ),
  transactions: [["wallets", "wallet_id"]],
  priorities: [["personal_projects", "project_id"]],
  workout_logs: [["workout_plans", "plan_id"]],
  personal_bill_payments: [
    ["personal_bills", "bill_id"],
    ["transactions", "transaction_id"],
  ],
};
function scope(table: string) {
  const parent = parents[table];
  return parent
    ? `EXISTS (SELECT 1 FROM ${parent[0]} p WHERE p.id = ${table}.${parent[1]} AND p.user_id = $1)`
    : `${table}.user_id = $1`;
}
export function validateBackup(input: any, userId: string) {
  if (
    !input ||
    input.format !== "atlas-personal" ||
    input.version !== 1 ||
    input.owner_id !== userId ||
    !input.tables ||
    typeof input.tables !== "object" ||
    Array.isArray(input.tables)
  )
    throw new PersonalError("Backup tidak valid atau berasal dari akun lain.");
  let count = 0;
  for (const [table, rows] of Object.entries(input.tables)) {
    if (
      !BACKUP_TABLES.includes(table) ||
      !Array.isArray(rows) ||
      rows.length > 10000 ||
      rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))
    )
      throw new PersonalError("Isi backup tidak valid.");
    count += rows.length;
  }
  if (count > 40000 || JSON.stringify(input).length > 4_500_000)
    throw new PersonalError(
      "Backup terlalu besar untuk dipulihkan melalui aplikasi.",
    );
  return count;
}
export async function exportPersonalBackup(userId: string) {
  return transaction(async (sql) => {
    await sql("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables: Record<string, any[]> = {};
    for (const table of BACKUP_TABLES) {
      tables[table] = (
        await sql(`SELECT * FROM ${table} WHERE ${scope(table)} LIMIT 10001`, [
          userId,
        ])
      ).map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== "embedding"),
        ),
      );
      if (tables[table].length > 10000)
        throw new PersonalError(
          "Data terlalu besar untuk ekspor melalui aplikasi.",
        );
    }
    const result = {
      format: "atlas-personal",
      version: 1,
      owner_id: userId,
      exported_at: new Date().toISOString(),
      tables,
    };
    validateBackup(result, userId);
    return result;
  });
}
async function columns(sql: SQL, table: string) {
  return sql(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
    [table],
  );
}
export async function restorePersonalBackup(userId: string, input: any) {
  const count = validateBackup(input, userId);
  return transaction(async (sql) => {
    for (const table of BACKUP_TABLES) {
      if (!input.tables[table]?.length) continue;
      const cols = await columns(sql, table);
      const known = new Set(cols.map((c) => c.column_name));
      const json = new Set(
        cols
          .filter((c) => c.data_type === "jsonb" || c.data_type === "json")
          .map((c) => c.column_name),
      );
      for (const source of input.tables[table]) {
        if (Object.keys(source).some((k) => !known.has(k) || k === "embedding"))
          throw new PersonalError(`Kolom backup ${table} tidak didukung.`);
        const row = { ...source };
        if (table === "personal_profiles") {
          try {
            row.preferences = personalPreferences(row.preferences);
          } catch {
            throw new PersonalError("Profil dalam backup tidak valid.");
          }
        }
        if (!parents[table]) row.user_id = userId;
        if (
          !["health_profiles", "personal_profiles"].includes(table) &&
          typeof row.id !== "string"
        )
          throw new PersonalError("ID backup tidak valid.");
        for (const [parent, col] of references[table] || []) {
          if (
            row[col] != null &&
            !(
              await sql(`SELECT id FROM ${parent} WHERE id=$1 AND user_id=$2`, [
                row[col],
                userId,
              ])
            ).length
          )
            throw new PersonalError(
              "Backup merujuk data yang hilang atau milik akun lain.",
            );
        }
        const key = ["health_profiles", "personal_profiles"].includes(table)
          ? "user_id"
          : "id";
        const existing = await sql(
          `SELECT ${key} FROM ${table} WHERE ${key}=$2 AND ${scope(table)}`,
          [userId, row[key]],
        );
        const collision = await sql(
          `SELECT ${key} FROM ${table} WHERE ${key}=$1`,
          [row[key]],
        );
        if (collision.length && !existing.length)
          throw new PersonalError(
            "ID backup berbenturan dengan data akun lain.",
            409,
          );
        const keys = Object.keys(row).filter((k) => known.has(k));
        const values = keys.map((k) =>
          json.has(k) && row[k] != null ? JSON.stringify(row[k]) : row[k],
        );
        const updates = keys
          .filter((k) => k !== key && k !== "user_id")
          .map((k) => `"${k}"=EXCLUDED."${k}"`);
        values.push(userId);
        const guard = scope(table).replace(/\$1/g, `$${values.length}`);
        const restored = await sql(
          `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT (${key}) ${updates.length ? `DO UPDATE SET ${updates.join(",")} WHERE ${guard}` : "DO NOTHING"} RETURNING ${key}`,
          values.slice(0, updates.length ? values.length : values.length - 1),
        );
        if (!restored.length && updates.length)
          throw new PersonalError(
            "ID backup berbenturan dengan data akun lain.",
            409,
          );
      }
    }
    return {
      message: `${count} baris dipulihkan. Data di luar backup tetap disimpan.`,
      count,
    };
  });
}
