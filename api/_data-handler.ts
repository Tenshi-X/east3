import { query, queryOne } from './_db';
import { requireUser } from './_auth';

const TABLES = new Set([
  'events', 'priorities', 'transactions', 'wallets', 'budgets', 'workout_plans',
  'workout_logs', 'workout_sets', 'habits', 'habit_logs', 'notes',
  'ai_conversations', 'ai_messages', 'ai_action_logs', 'morning_briefs',
]);
const PARENTS: Record<string, { column: string; table: string }> = {
  habit_logs: { column: 'habit_id', table: 'habits' },
  workout_sets: { column: 'workout_log_id', table: 'workout_logs' },
  ai_messages: { column: 'conversation_id', table: 'ai_conversations' },
};
const CONFLICTS: Record<string, string[]> = {
  budgets: ['user_id', 'category', 'month'],
  habit_logs: ['habit_id', 'date'],
  morning_briefs: ['user_id', 'date'],
};
const PROTECTED = new Set(['id', 'user_id', 'created_at', 'updated_at']);
const columnCache = new Map<string, Set<string>>();
type DataRequest = { method?: string; headers: any; body?: any; query?: any };
type DataResponse = { status(code: number): any; json(body: any): any };
class RequestError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

async function columnsFor(table: string) {
  if (!columnCache.has(table)) {
    const rows = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [table]);
    columnCache.set(table, new Set(rows.map(row => row.column_name)));
  }
  return columnCache.get(table)!;
}

// Child rows inherit ownership from their parent, never from request fields.
function ownership(table: string, parameter: number) {
  const parent = PARENTS[table];
  return parent
    ? `EXISTS (SELECT 1 FROM ${parent.table} owner WHERE owner.id = ${table}.${parent.column} AND owner.user_id = $${parameter})`
    : `${table}.user_id = $${parameter}`;
}

async function validateParent(table: string, row: Record<string, any>, userId: string, partial: boolean) {
  const parent = PARENTS[table] ?? (table === 'workout_logs' ? { column: 'plan_id', table: 'workout_plans' }
    : table === 'transactions' ? { column: 'wallet_id', table: 'wallets' } : undefined);
  if (!parent || (partial && !(parent.column in row))) return;
  if (!row[parent.column]) {
    if (table === 'workout_logs' || (table === 'transactions' && row.wallet_id == null)) return;
    throw new RequestError(400, `${parent.column} required`);
  }
  const owned = await queryOne(`SELECT id FROM ${parent.table} WHERE id = $1 AND user_id = $2`, [row[parent.column], userId]);
  if (!owned) throw new RequestError(404, 'Parent not found');
}

function integer(value: unknown, fallback: number, max: number) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new RequestError(400, 'Invalid pagination');
  return n;
}

export async function handleDataRequest(req: DataRequest, res: DataResponse, table: string, id?: string) {
  try {
    const { user, error } = await requireUser(req);
    if (!user || error) return res.status(401).json({ error: error ?? 'Unauthorized' });
    if (!TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
    const method = req.method ?? 'GET';
    const q = req.query ?? {};
    const cols = await columnsFor(table);

    // Increment in PostgreSQL so simultaneous clicks/devices do not lose progress.
    if (method === 'POST' && table === 'habit_logs' && id === 'increment') {
      const { habit_id, date, delta } = req.body ?? {};
      if (typeof habit_id !== 'string' || !habit_id || typeof date !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof delta !== 'number' ||
          !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 99999999.99 ||
          Math.abs(delta * 100 - Math.round(delta * 100)) > 0.00001) {
        throw new RequestError(400, 'Progres kebiasaan tidak valid.');
      }
      const rows = await query(`INSERT INTO habit_logs (habit_id, date, value, is_completed)
        SELECT id, $3::date, GREATEST(0, $4::numeric), GREATEST(0, $4::numeric) >= COALESCE(target_value, 1)
        FROM habits WHERE id = $1 AND user_id = $2
        ON CONFLICT (habit_id, date) DO UPDATE SET
          value = GREATEST(0, COALESCE(habit_logs.value, 0) + $4::numeric),
          is_completed = GREATEST(0, COALESCE(habit_logs.value, 0) + $4::numeric) >=
            (SELECT COALESCE(target_value, 1) FROM habits WHERE id = $1 AND user_id = $2)
        WHERE EXISTS (SELECT 1 FROM habits WHERE id = habit_logs.habit_id AND user_id = $2)
        RETURNING *`, [habit_id, user.id, date, delta]);
      return rows.length ? res.json({ data: rows[0] }) : res.status(404).json({ error: 'Kebiasaan tidak ditemukan.' });
    }

    if (method === 'GET') {
      const values: any[] = [user.id];
      const where = [ownership(table, 1)];
      const select = table === 'wallets' ? `wallets.*, opening_balance + COALESCE((
        SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END)
        FROM transactions WHERE wallet_id = wallets.id AND transactions.user_id = $1
      ), 0) AS balance` : '*';
      if (id) {
        values.push(id);
        const row = await queryOne(`SELECT ${select} FROM ${table} WHERE ${where[0]} AND id = $2`, values);
        return row ? res.json({ data: row }) : res.status(404).json({ error: 'Not found' });
      }
      const operators: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', ilike: 'ILIKE' };
      for (const [key, value] of Object.entries(q)) {
        const match = /^filter_(eq|neq|gt|gte|lt|lte|ilike|in)_(.+)$/.exec(key);
        if (!match || !cols.has(match[2])) continue;
        const [, op, col] = match;
        if (op === 'in') {
          const items = String(value).split(',').filter(Boolean);
          if (!items.length) { where.push('FALSE'); continue; }
          const placeholders = items.map(item => { values.push(item); return `$${values.length}`; });
          where.push(`${col} IN (${placeholders.join(', ')})`);
        } else {
          values.push(value);
          where.push(`${col} ${operators[op]} $${values.length}`);
        }
      }
      const order = typeof q.order_by === 'string' && cols.has(q.order_by) ? q.order_by : 'created_at';
      const direction = q.order_dir === 'asc' ? 'ASC' : 'DESC';
      const limit = Math.max(1, integer(q.limit, 100, 500));
      const offset = integer(q.offset, 0, Number.MAX_SAFE_INTEGER);
      const tieBreak = order === 'id' ? '' : `, id ${direction}`;
      const rows = await query(`SELECT ${select} FROM ${table} WHERE ${where.join(' AND ')} ORDER BY ${order} ${direction}${tieBreak} LIMIT ${limit + 1} OFFSET ${offset}`, values);
      return res.json({ data: rows.slice(0, limit), has_more: rows.length > limit });
    }

    if (method === 'DELETE' && id) {
      const rows = await query(`DELETE FROM ${table} WHERE id = $1 AND ${ownership(table, 2)} RETURNING id`, [id, user.id]);
      return rows.length ? res.json({ success: true }) : res.status(404).json({ error: 'Not found' });
    }

    const upsert = method === 'POST' && id === 'upsert';
    if ((method === 'POST' && (!id || upsert)) || (method === 'PATCH' && id)) {
      const row = upsert ? req.body?.row : req.body;
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new RequestError(400, 'Body must be an object');
      for (const key of Object.keys(row)) {
        if (!cols.has(key) || PROTECTED.has(key)) throw new RequestError(400, `Invalid field: ${key}`);
      }
      if (!Object.keys(row).length) throw new RequestError(400, 'No fields provided');
      if (table === 'wallets') {
        if (('name' in row && (typeof row.name !== 'string' || !row.name.trim() || row.name.trim().length > 80)) ||
            ('type' in row && !['bank', 'ewallet', 'cash', 'other'].includes(row.type)) ||
            ('opening_balance' in row && (row.opening_balance == null || typeof row.opening_balance === 'boolean' ||
              !Number.isFinite(Number(row.opening_balance)) || Math.abs(Number(row.opening_balance)) > 9999999999999.99))) {
          throw new RequestError(400, 'Data kantong tidak valid.');
        }
        if ('name' in row) row.name = row.name.trim();
      }
      if (table === 'habits') {
        for (const field of ['target_value', 'step_value']) {
          if (field in row && (row[field] == null || typeof row[field] === 'boolean' ||
              !Number.isFinite(Number(row[field])) || Number(row[field]) < 0.01 || Number(row[field]) > 99999999.99)) {
            throw new RequestError(400, 'Target dan jumlah per ketukan harus lebih dari nol.');
          }
        }
        if ('settings' in row && (!row.settings || typeof row.settings !== 'object' || Array.isArray(row.settings))) {
          throw new RequestError(400, 'Preferensi kebiasaan tidak valid.');
        }
      }
      if (table === 'workout_plans' && 'day_of_week' in row &&
          (!Array.isArray(row.day_of_week) || row.day_of_week.some((day: any) => !Number.isInteger(day) || day < 0 || day > 6))) {
        throw new RequestError(400, 'day_of_week must be an array of days 0–6');
      }
      await validateParent(table, row, user.id, method === 'PATCH');
      const keys = Object.keys(row);
      const values: any[] = keys.map(key => row[key]);
      if (method === 'PATCH') {
        const updates = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        values.push(id, user.id);
        const rows = await query(`UPDATE ${table} SET ${updates} WHERE id = $${values.length - 1} AND ${ownership(table, values.length)} RETURNING *`, values);
        return rows.length ? res.json({ data: rows[0] }) : res.status(404).json({ error: 'Not found' });
      }
      if (!PARENTS[table]) { keys.push('user_id'); values.push(user.id); }
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      let conflict = '';
      if (upsert) {
        const allowed = CONFLICTS[table];
        const requested = typeof req.body.on_conflict === 'string' ? req.body.on_conflict.split(',').map((c: string) => c.trim()) : [];
        if (!allowed || requested.length !== allowed.length || new Set(requested).size !== allowed.length || requested.some((c: string) => !allowed.includes(c))) {
          throw new RequestError(400, 'Invalid conflict columns');
        }
        if (allowed.some(c => !keys.includes(c))) throw new RequestError(400, 'Conflict fields required');
        const updates = keys.filter(key => !allowed.includes(key)).map(key => `${key} = EXCLUDED.${key}`);
        if (!updates.length) throw new RequestError(400, 'No updatable fields');
        values.push(user.id);
        conflict = ` ON CONFLICT (${allowed.join(', ')}) DO UPDATE SET ${updates.join(', ')} WHERE ${ownership(table, values.length)}`;
      }
      const rows = await query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})${conflict} RETURNING *`, values);
      return rows.length ? res.status(201).json({ data: rows[0] }) : res.status(404).json({ error: 'Not found' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof RequestError) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === '23503' && table === 'wallets') return res.status(409).json({ error: 'Kantong masih memiliki transaksi. Pindahkan transaksinya sebelum menghapus kantong.' });
    if (['22P02', '22003', '22007', '22008', '23502', '23503', '23514'].includes(error.code)) return res.status(400).json({ error: 'Invalid data' });
    if (error.code === '23505') return res.status(409).json({ error: 'Data already exists' });
    console.error('Data API failed:', error.message);
    return res.status(500).json({ error: 'Data tidak dapat diproses. Coba lagi.' });
  }
}
