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

// All routes require auth
router.use(async (req: Request, res: Response, next: any) => {
  const { user, error } = await requireUser(req);
  if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });
  (req as any).user = user;
  next();
});

// GET /api/data/:table - list
router.get('/:table', async (req: Request, res: Response) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });

  const user = (req as any).user;
  const rows = await query(`SELECT * FROM ${table} WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [user.id]);
  return res.json({ data: rows });
});

// GET /api/data/:table/:id - get one
router.get('/:table/:id', async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });

  const user = (req as any).user;
  const row = await queryOne(`SELECT * FROM ${table} WHERE id = $1 AND user_id = $2`, [id, user.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: row });
});

// POST /api/data/:table - create
router.post('/:table', async (req: Request, res: Response) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });

  const user = (req as any).user;
  const body = { ...req.body, user_id: user.id };
  const columns = Object.keys(body);
  if (columns.length === 0) return res.status(400).json({ error: 'No data provided' });

  const values = columns.map((_, i) => `$${i + 1}`);
  const rows = await query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`,
    Object.values(body)
  );
  return res.status(201).json({ data: rows[0] });
});

// PATCH /api/data/:table/:id - update
router.patch('/:table/:id', async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });

  const user = (req as any).user;
  const body = req.body ?? {};
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(body)) {
    updates.push(`${key} = $${idx++}`);
    values.push(val);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id, user.id);
  const rows = await query(
    `UPDATE ${table} SET ${updates.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: rows[0] });
});

// DELETE /api/data/:table/:id - delete
router.delete('/:table/:id', async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });

  const user = (req as any).user;
  const result = await query(`DELETE FROM ${table} WHERE id = $1 AND user_id = $2`, [id, user.id]);
  return res.json({ success: true });
});

export default router;
