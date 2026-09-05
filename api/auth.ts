import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne, query } from './_db';
import { hashPassword, verifyPassword, signToken, requireUser } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? '';
  const path = url.replace(/^\/api\/auth\/?/, '').split('?')[0];
  const method = req.method ?? 'GET';

  // ─── POST /api/auth/register ────────────────────────────────────────────────
  if (path === 'register' && method === 'POST') {
    const { email, password, display_name } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check existing
    const existing = await queryOne(`SELECT id FROM users WHERE email = $1`, [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const { hash, salt } = hashPassword(String(password));
    const rows = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, salt, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [normalizedEmail, hash, salt, display_name ?? null]
    );
    const user = rows[0];

    const token = signToken({ sub: user.id });
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: normalizedEmail,
        display_name: display_name ?? null,
        timezone: 'Asia/Jakarta',
        morning_brief_time: '07:00:00',
      },
    });
  }

  // ─── POST /api/auth/login ───────────────────────────────────────────────────
  if (path === 'login' && method === 'POST') {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await queryOne<{
      id: string;
      email: string;
      password_hash: string;
      salt: string;
      display_name: string | null;
      timezone: string;
      morning_brief_time: string;
    }>(
      `SELECT id, email, password_hash, salt, display_name, timezone, morning_brief_time
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (!user || !verifyPassword(String(password), user.salt, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ sub: user.id });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        timezone: user.timezone,
        morning_brief_time: user.morning_brief_time,
      },
    });
  }

  // ─── GET /api/auth/me ───────────────────────────────────────────────────────
  if (path === 'me' && method === 'GET') {
    const { user, error } = await requireUser(req);
    if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });
    return res.json({ user });
  }

  // ─── PATCH /api/auth/me ─────────────────────────────────────────────────────
  if (path === 'me' && method === 'PATCH') {
    const { user, error } = await requireUser(req);
    if (error || !user) return res.status(401).json({ error: error ?? 'Unauthorized' });

    const { display_name, timezone, morning_brief_time } = req.body ?? {};
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (display_name !== undefined) { updates.push(`display_name = $${idx++}`); params.push(display_name); }
    if (timezone !== undefined) { updates.push(`timezone = $${idx++}`); params.push(timezone); }
    if (morning_brief_time !== undefined) { updates.push(`morning_brief_time = $${idx++}`); params.push(morning_brief_time); }

    if (updates.length === 0) return res.json({ user });

    params.push(user.id);
    const updated = await queryOne<{
      id: string;
      email: string;
      display_name: string | null;
      timezone: string;
      morning_brief_time: string;
    }>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, email, display_name, timezone, morning_brief_time`,
      params
    );

    return res.json({ user: updated });
  }

  return res.status(404).json({ error: 'Not found' });
}