import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne } from './_db';
import { requireUser } from './_auth';

// Whitelist of tables that can be accessed via the generic API
const ALLOWED_TABLES = new Set([
  'events',
  'priorities',
  'transactions',
  'budgets',
  'workout_plans',
  'workout_logs',
  'workout_sets',
  'habits',
  'habit_logs',
  'notes',
  'ai_conversations',
  'ai_messages',
  'ai_action_logs',
  'morning_briefs',
]);

// Columns that are safe to filter on (prevent SQL injection)
const FILTERABLE_COLUMNS = new Set([
  'id', 'user_id', 'date', 'month', 'category', 'type', 'source',
  'habit_id', 'conversation_id', 'workout_log_id', 'plan_id',
  'is_active', 'is_done', 'is_undone', 'title', 'start_time', 'end_time',
  'occurred_at', 'created_at', 'updated_at', 'exercise_name',
]);

function parseFilters(queryParams: Record<string, string | string[] | undefined>) {
  const filters: { column: string; operator: string; value: any }[] = [];
  for (const [key, value] of Object.entries(queryParams)) {
    if (key.startsWith('filter_')) {
      const rest = key.slice(7);
      const rawValue = Array.isArray(value) ? value[0] : value;
      if (rawValue === undefined) continue;

      // Format: filter_<op>_<column>  OR  filter_<column> (defaults to eq)
      const parts = rest.split('_');
      let operator = 'eq';
      let column = rest;
      if (parts.length >= 2 && ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'in'].includes(parts[0])) {
        operator = parts[0];
        column = parts.slice(1).join('_');
      }
      if (!FILTERABLE_COLUMNS.has(column)) continue;
      filters.push({ column, operator, value: rawValue });
    }
  }
  return filters;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { user, error } = await requireUser(req);
  if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });

  const url = req.url ?? '';
  const path = url.replace(/^\/api\/data\/?/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  const table = parts[0];
  const id = parts[1];

  if (!table || !ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Invalid table' });
  }

  const method = req.method ?? 'GET';

  // ─── POST /api/data/:table/upsert ───────────────────────────────────────────
  if (method === 'POST' && id === 'upsert') {
    const body = req.body ?? {};
    const onConflict = String((req.query as any).onConflict ?? '').split(',').filter(Boolean);
    if (onConflict.length === 0) {
      return res.status(400).json({ error: 'onConflict required' });
    }

    // For tables without user_id, resolve ownership via parent
    let insertData = { ...body };
    if (table === 'workout_sets') {
      const { workout_log_id } = body;
      if (!workout_log_id) return res.status(400).json({ error: 'workout_log_id required' });
      const log = await queryOne(`SELECT id FROM workout_logs WHERE id = $1 AND user_id = $2`, [workout_log_id, user.id]);
      if (!log) return res.status(404).json({ error: 'Workout log not found' });
    } else if (table === 'habit_logs') {
      const { habit_id } = body;
      if (!habit_id) return res.status(400).json({ error: 'habit_id required' });
      const habit = await queryOne(`SELECT id FROM habits WHERE id = $1 AND user_id = $2`, [habit_id, user.id]);
      if (!habit) return res.status(404).json({ error: 'Habit not found' });
    } else if (table === 'ai_messages') {
      const { conversation_id } = body;
      if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });
      const conv = await queryOne(`SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversation_id, user.id]);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      insertData = { ...body, user_id: user.id };
    }

    const columns = Object.keys(insertData);
    if (columns.length === 0) return res.status(400).json({ error: 'No data provided' });

    const values = columns.map((_, i) => `$${i + 1}`);
    const params = columns.map(c => insertData[c]);
    const updateSet = columns.map(c => `${c} = EXCLUDED.${c}`).join(', ');

    const rows = await query(
      `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${values.join(', ')})
       ON CONFLICT (${onConflict.join(', ')})
       DO UPDATE SET ${updateSet}
       RETURNING *`,
      params
    );
    return res.status(201).json({ data: rows[0] });
  }

  // ─── GET /api/data/:table ───────────────────────────────────────────────────
  if (method === 'GET' && !id) {
    const filters = parseFilters(req.query as any);
    const where: string[] = ['user_id = $1'];
    const params: any[] = [user.id];

    // Special case: workout_sets and habit_logs don't have user_id directly
    if (table === 'workout_sets') {
      where.length = 0;
      where.push(`EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = workout_log_id AND wl.user_id = $1)`);
    } else if (table === 'habit_logs') {
      where.length = 0;
      where.push(`EXISTS (SELECT 1 FROM habits h WHERE h.id = habit_id AND h.user_id = $1)`);
    } else if (table === 'ai_messages') {
      where.length = 0;
      where.push(`EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = conversation_id AND c.user_id = $1)`);
    }

    let idx = 2;
    for (const f of filters) {
      switch (f.operator) {
        case 'gte':
          where.push(`${f.column} >= $${idx++}`);
          params.push(f.value);
          break;
        case 'lte':
          where.push(`${f.column} <= $${idx++}`);
          params.push(f.value);
          break;
        case 'gt':
          where.push(`${f.column} > $${idx++}`);
          params.push(f.value);
          break;
        case 'lt':
          where.push(`${f.column} < $${idx++}`);
          params.push(f.value);
          break;
        case 'ilike':
          where.push(`${f.column} ILIKE $${idx++}`);
          params.push(`%${f.value}%`);
          break;
        case 'in': {
          const values = String(f.value).split(',').filter(Boolean);
          if (values.length > 0) {
            const placeholders = values.map(() => `$${idx++}`).join(', ');
            where.push(`${f.column} IN (${placeholders})`);
            params.push(...values);
          }
          break;
        }
        case 'neq':
          where.push(`${f.column} != $${idx++}`);
          params.push(f.value);
          break;
        default:
          where.push(`${f.column} = $${idx++}`);
          params.push(f.value);
      }
    }

    // Ordering
    const orderBy = (req.query as any).order_by;
    const orderDir = (req.query as any).order_dir === 'asc' ? 'ASC' : 'DESC';
    const orderClause = orderBy && FILTERABLE_COLUMNS.has(orderBy)
      ? `ORDER BY ${orderBy} ${orderDir}`
      : 'ORDER BY created_at DESC';

    // Limit
    const limit = Math.min(Number((req.query as any).limit) || 50, 200);

    const rows = await query(
      `SELECT * FROM ${table} WHERE ${where.join(' AND ')} ${orderClause} LIMIT ${limit}`,
      params
    );
    return res.json({ data: rows });
  }

  // ─── GET /api/data/:table/:id ───────────────────────────────────────────────
  if (method === 'GET' && id) {
    let row;
    if (table === 'workout_sets') {
      row = await queryOne(
        `SELECT ws.* FROM workout_sets ws
         JOIN workout_logs wl ON wl.id = ws.workout_log_id
         WHERE ws.id = $1 AND wl.user_id = $2`,
        [id, user.id]
      );
    } else if (table === 'habit_logs') {
      row = await queryOne(
        `SELECT hl.* FROM habit_logs hl
         JOIN habits h ON h.id = hl.habit_id
         WHERE hl.id = $1 AND h.user_id = $2`,
        [id, user.id]
      );
    } else if (table === 'ai_messages') {
      row = await queryOne(
        `SELECT am.* FROM ai_messages am
         JOIN ai_conversations c ON c.id = am.conversation_id
         WHERE am.id = $1 AND c.user_id = $2`,
        [id, user.id]
      );
    } else {
      row = await queryOne(`SELECT * FROM ${table} WHERE id = $1 AND user_id = $2`, [id, user.id]);
    }

    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json({ data: row });
  }

  // ─── POST /api/data/:table ──────────────────────────────────────────────────
  if (method === 'POST' && !id) {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be an object' });
    }

    // For tables without user_id, resolve ownership via parent
    let insertData = { ...body };
    if (table === 'workout_sets') {
      const { workout_log_id } = body;
      if (!workout_log_id) return res.status(400).json({ error: 'workout_log_id required' });
      const log = await queryOne(`SELECT id FROM workout_logs WHERE id = $1 AND user_id = $2`, [workout_log_id, user.id]);
      if (!log) return res.status(404).json({ error: 'Workout log not found' });
    } else if (table === 'habit_logs') {
      const { habit_id } = body;
      if (!habit_id) return res.status(400).json({ error: 'habit_id required' });
      const habit = await queryOne(`SELECT id FROM habits WHERE id = $1 AND user_id = $2`, [habit_id, user.id]);
      if (!habit) return res.status(404).json({ error: 'Habit not found' });
    } else if (table === 'ai_messages') {
      const { conversation_id } = body;
      if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });
      const conv = await queryOne(`SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversation_id, user.id]);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      insertData = { ...body, user_id: user.id };
    }

    const columns = Object.keys(insertData);
    if (columns.length === 0) return res.status(400).json({ error: 'No data provided' });

    const values = columns.map((_, i) => `$${i + 1}`);
    const params = columns.map(c => insertData[c]);

    const rows = await query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`,
      params
    );
    return res.status(201).json({ data: rows[0] });
  }

  // ─── PATCH /api/data/:table/:id ─────────────────────────────────────────────
  if (method === 'PATCH' && id) {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be an object' });
    }

    const columns = Object.keys(body);
    if (columns.length === 0) return res.status(400).json({ error: 'No data provided' });

    const sets = columns.map((c, i) => `${c} = $${i + 1}`);
    const params = [...columns.map(c => body[c]), id];

    // Ownership check
    let row;
    if (table === 'workout_sets') {
      row = await queryOne(
        `UPDATE workout_sets SET ${sets.join(', ')}
         WHERE id = $${params.length}
           AND EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = workout_log_id AND wl.user_id = $${params.length + 1})
         RETURNING *`,
        [...params, user.id]
      );
    } else if (table === 'habit_logs') {
      row = await queryOne(
        `UPDATE habit_logs SET ${sets.join(', ')}
         WHERE id = $${params.length}
           AND EXISTS (SELECT 1 FROM habits h WHERE h.id = habit_id AND h.user_id = $${params.length + 1})
         RETURNING *`,
        [...params, user.id]
      );
    } else if (table === 'ai_messages') {
      row = await queryOne(
        `UPDATE ai_messages SET ${sets.join(', ')}
         WHERE id = $${params.length}
           AND EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = conversation_id AND c.user_id = $${params.length + 1})
         RETURNING *`,
        [...params, user.id]
      );
    } else {
      row = await queryOne(
        `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${params.length} AND user_id = $${params.length + 1} RETURNING *`,
        [...params, user.id]
      );
    }

    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json({ data: row });
  }

  // ─── DELETE /api/data/:table/:id ────────────────────────────────────────────
  if (method === 'DELETE' && id) {
    let deleted;
    if (table === 'workout_sets') {
      deleted = await queryOne(
        `DELETE FROM workout_sets
         WHERE id = $1
           AND EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = workout_log_id AND wl.user_id = $2)
         RETURNING id`,
        [id, user.id]
      );
    } else if (table === 'habit_logs') {
      deleted = await queryOne(
        `DELETE FROM habit_logs
         WHERE id = $1
           AND EXISTS (SELECT 1 FROM habits h WHERE h.id = habit_id AND h.user_id = $2)
         RETURNING id`,
        [id, user.id]
      );
    } else if (table === 'ai_messages') {
      deleted = await queryOne(
        `DELETE FROM ai_messages
         WHERE id = $1
           AND EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = conversation_id AND c.user_id = $2)
         RETURNING id`,
        [id, user.id]
      );
    } else {
      deleted = await queryOne(
        `DELETE FROM ${table} WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, user.id]
      );
    }

    if (!deleted) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}