import { Router, Request, Response } from 'express';
import { query, queryOne } from './_db';
import { requireUser } from './_auth';

const router = Router();

const ALLOWED_TABLES = new Set([
  'events', 'priorities', 'transactions', 'budgets',
  'workout_plans', 'workout_logs', 'workout_sets',
  'habits', 'habit_logs', 'notes',
  'ai_conversations', 'ai_messages', 'ai_action_logs', 'morning_briefs',
]);

const columnCache = new Map<string, Set<string>>();
async function getColumns(table: string): Promise<Set<string>> {
  if (columnCache.has(table)) return columnCache.get(table)!;
  const rows = await query<{ column_name: string }>(
    'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
    [table]
  );
  const set = new Set(rows.map((r) => r.column_name));
  columnCache.set(table, set);
  return set;
}

const userIdColCache = new Map<string, boolean>();
async function hasUserIdCol(table: string): Promise<boolean> {
  if (userIdColCache.has(table)) return userIdColCache.get(table)!;
  const rows = await query<{ cnt: number }>(
    "SELECT COUNT(*)::int AS cnt FROM information_schema.columns WHERE table_name = $1 AND column_name = 'user_id'",
    [table]
  );
  const ok = (rows[0]?.cnt ?? 0) > 0;
  userIdColCache.set(table, ok);
  return ok;
}

router.use(async (req: Request, res: Response, next: any) => {
  const { user, error } = await requireUser(req);
  if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });
  (req as any).user = user;
  next();
});

router.get('/:table', async (req: Request, res: Response) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
  const user = (req as any).user;
  const cols = await getColumns(table);
  const q = req.query as Record<string, any>;
  const hasUser = await hasUserIdCol(table);
  const where: string[] = [];
  const values: any[] = [];
  if (hasUser) { where.push('user_id = $1'); values.push(user.id); }
  let idx = values.length + 1;
  for (const [key, rawVal] of Object.entries(q)) {
    const val = String(rawVal);
    let op: string | null = null;
    if (key.startsWith('filter_eq_')) op = '=';
    else if (key.startsWith('filter_gte_')) op = '>=';
    else if (key.startsWith('filter_lte_')) op = '<=';
    if (!op) continue;
    const col = key.replace(/^filter_(eq|gte|lte)_/, '');
    if (!cols.has(col)) continue;
    where.push(`${col} ${op} $${idx++}`);
    values.push(val);
  }
  let orderBy = 'created_at';
  if (typeof q.order_by === 'string' && cols.has(q.order_by)) orderBy = q.order_by;
  const orderDir = q.order_dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
  const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM ${table}${whereSql} ORDER BY ${orderBy} ${orderDir} LIMIT ${limit}`, values);
  return res.json({ data: rows });

router.get('/:table/:id', async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
  const user = (req as any).user;
  const hasUser = await hasUserIdCol(table);
  const sql = hasUser ? `SELECT * FROM ${table} WHERE user_id = $1 AND id = $2` : `SELECT * FROM ${table} WHERE id = $1`;
  const vals = hasUser ? [user.id, id] : [id];
  const row = await queryOne(sql, vals);
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: row });
});

router.post('/:table', async (req: Request, res: Response) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
  const user = (req as any).user;
  const body = req.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Invalid body' });
  const cols = await getColumns(table);
  const keys: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at' || !cols.has(key)) continue;
    keys.push(key);
    values.push(val);
  }
  if (await hasUserIdCol(table)) { keys.push('user_id'); values.push(user.id); }
  if (keys.length === 0) return res.status(400).json({ error: 'No fields to insert' });
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
  return res.status(201).json({ data: rows[0] });
});

router.patch('/:table/:id', async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
  const user = (req as any).user;
  const body = req.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Invalid body' });
  const cols = await getColumns(table);
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (key === 'id' || key === 'user_id' || key === 'created_at' || !cols.has(key)) continue;
    updates.push(`${key} = $${values.length + 1}`);
    values.push(val);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  const hasUser = await hasUserIdCol(table);
  values.push(id);
  const idParam = values.length;
  if (hasUser) values.push(user.id);
  const where = hasUser ? `id = $${idParam} AND user_id = $${idParam + 1}` : `id = $${idParam}`;
  const rows = await query(`UPDATE ${table} SET ${updates.join(', ')} WHERE ${where} RETURNING *`, values);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: rows[0] });
});

router.post('/:table/upsert', async (req: Request, res: Response) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
  const user = (req as any).user;
  const { row, on_conflict } = (req.body ?? {}) as { row?: Record<string, any>; on_conflict?: string };
  if (!row || typeof row !== 'object') return res.status(400).json({ error: 'row required' });
  if (!on_conflict || !/^[a-z_,]+$/.test(on_conflict)) return res.status(400).json({ error: 'on_conflict required' });
  const cols = await getColumns(table);
  const conflictCols = on_conflict.split(',').map((c) => c.trim()).filter((c) => cols.has(c));
  if (conflictCols.length === 0) return res.status(400).json({ error: 'Invalid conflict columns' });
  const keys: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || k === 'user_id' || k === 'created_at' || k === 'updated_at' || !cols.has(k)) continue;
    keys.push(k);
    values.push(v);
  }
  const hasUser = await hasUserIdCol(table);
  if (hasUser) {
    keys.push('user_id');
    values.push(user.id);
    for (const c of conflictCols) { if (!keys.includes(c)) { keys.push(c); values.push(row[c] ?? null); } }
  }
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const updates = keys.filter((k) => !conflictCols.includes(k) && k !== 'user_id').map((k) => `${k} = EXCLUDED.${k}`);
  if (updates.length === 0) return res.status(400).json({ error: 'No updatable fields' });
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING *`;
  const rows = await query(sql, values);
  return res.status(201).json({ data: rows[0] });
});

router.delete('/:table/:id', async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
  const user = (req as any).user;
  const hasUser = await hasUserIdCol(table);
  const sql = hasUser ? `DELETE FROM ${table} WHERE id = $1 AND user_id = $2 RETURNING id` : `DELETE FROM ${table} WHERE id = $1 RETURNING id`;
  const vals = hasUser ? [id, user.id] : [id];
  const rows = await query(sql, vals);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  return res.json({ success: true });
});

export default router;
});
