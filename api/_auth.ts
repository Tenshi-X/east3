import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { queryOne } from './_db';
import { isAtlasOwner } from './_owner';

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET required');
  return 'dev-secret-change-me';
}

// ─── Password hashing (HMAC-SHA256 with per-user salt) ───────────────────────
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomSalt();
  const hash = createHmac('sha256', s)
    .update(password)
    .digest('hex');
  return { hash, salt: s };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash), b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a,b);
}

function randomSalt(): string {
  return Array.from(randomBytes(16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── JWT (HS256) ──────────────────────────────────────────────────────────────
function base64UrlEncode(data: string | Buffer): string {
  return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - data.length % 4) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function signToken(payload: Record<string, any>, expiresInSeconds = 60 * 60 * 24 * 30): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }));
  const signature = createHmac('sha256', jwtSecret())
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): Record<string, any> | null {
  try {
    if (token.split('.').length !== 3) return null;
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;

    const expected = createHmac('sha256', jwtSecret())
      .update(`${header}.${body}`)
      .digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected),Buffer.from(signature))) return null;

    const payload = JSON.parse(base64UrlDecode(body));
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export function getBearerToken(req: { headers: any }): string | null {
  const auth = req.headers.authorization ?? req.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function requireUser(req: { headers: any }) {
  const token = getBearerToken(req);
  if (!token) return { user: null, error: 'Unauthorized' };

  const payload = verifyToken(token);
  if (!payload?.sub) return { user: null, error: 'Invalid token' };

  const user = await queryOne<{
    id: string;
    email: string;
    display_name: string | null;
    timezone: string;
    morning_brief_time: string;
    created_at: string;
  }>(
    `SELECT id, email, display_name, timezone, morning_brief_time, created_at
     FROM users WHERE id = $1`,
    [payload.sub]
  );

  if (!user) return { user: null, error: 'User not found' };
  if (!(await isAtlasOwner(user))) return { user: null, error: 'Atlas hanya tersedia untuk akun pemilik.' };
  return { user, error: null };
}
