// ─────────────────────────────────────────────────────────────────────────────
// east3 API Client — replaces @supabase/supabase-js with a lightweight REST client
// All requests go through the Vercel API (which uses Neon PostgreSQL)
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let accessToken: string | null = null;
let sessionListeners: ((event: string, session: any) => void)[] = [];

// ─── Token / session management ──────────────────────────────────────────────
export function setAccessToken(token: string | null) {
  accessToken = token;
  const session = token
    ? { user: getUserFromToken(token), access_token: token }
    : null;
  sessionListeners.forEach(l => l(token ? 'SIGNED_IN' : 'SIGNED_OUT', session));
}

function base64UrlDecode(input: string): string {
  // Convert base64url to base64
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with = to multiple of 4
  while (base64.length % 4) base64 += '=';
  // Decode manually (works in RN without atob)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let buffer = 0;
  let bits = 0;
  for (const c of base64) {
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return result;
}

export function getUserFromToken(token: string): any {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(base64UrlDecode(payload));
    return {
      id: decoded.sub,
      email: decoded.email ?? '',
      aud: 'authenticated',
      role: 'authenticated',
    };
  } catch {
    return { id: '', email: '', aud: 'authenticated', role: 'authenticated' };
  }
}

// ─── Core request helper ──────────────────────────────────────────────────────
async function request<T = any>(
  path: string,
  options: {
    method?: string;
    body?: any;
    auth?: boolean;
    query?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true, query } = options;

  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorMsg = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      errorMsg = data.error ?? errorMsg;
    } catch { /* keep default */ }
    throw new Error(errorMsg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth API ────────────────────────────────────────────────────────────────
export const auth = {
  async signUp(email: string, password: string, displayName?: string) {
    const data = await request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: { email, password, display_name: displayName },
    });
    setAccessToken(data.token);
    return { data: { session: { user: data.user, access_token: data.token } }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const data = await request<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password },
      });
      setAccessToken(data.token);
      return { data: { session: { user: data.user, access_token: data.token } }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  async signOut() {
    setAccessToken(null);
    return { error: null };
  },

  async getSession() {
    if (!accessToken) return { data: { session: null } };
    return {
      data: {
        session: {
          user: getUserFromToken(accessToken),
          access_token: accessToken,
        },
      },
    };
  },

  async getUser() {
    if (!accessToken) return { data: { user: null } };
    try {
      const { user } = await request<{ user: any }>('/api/auth/me');
      return { data: { user } };
    } catch {
      return { data: { user: getUserFromToken(accessToken) } };
    }
  },

  onAuthStateChange(listener: (event: string, session: any) => void) {
    sessionListeners.push(listener);
    const session = accessToken
      ? { user: getUserFromToken(accessToken), access_token: accessToken }
      : null;
    listener(session ? 'INITIAL_SESSION' : 'SIGNED_OUT', session);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            sessionListeners = sessionListeners.filter(l => l !== listener);
          },
        },
      },
    };
  },
};

// ─── Data API (Supabase-compatible thenable query builder) ───────────────────
type Filter = {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in';
  value: any;
};

type PendingOp = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

class TableQuery<T = any> {
  private filters: Filter[] = [];
  private orderColumn: string | null = null;
  private orderAscending = false;
  private rowLimit: number | null = null;
  private singleRow = false;
  private pendingOp: PendingOp | null = null;
  private pendingValues: any = null;
  private pendingOnConflict: string | null = null;

  constructor(
    private table: string,
    private id?: string
  ) {}

  // ─── Filter builders (chainable) ────────────────────────────────────────────
  eq(column: string, value: any) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  ilike(column: string, value: any) {
    this.filters.push({ column, operator: 'ilike', value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = opts?.ascending ?? false;
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  // ─── Operation starters (chainable, executed on await) ─────────────────────
  select(columns = '*') {
    this.pendingOp = 'select';
    return this;
  }

  insert(values: any) {
    this.pendingOp = 'insert';
    this.pendingValues = Array.isArray(values) ? values[0] : values;
    return this;
  }

  upsert(values: any, opts?: { onConflict?: string }) {
    this.pendingOp = 'upsert';
    this.pendingValues = Array.isArray(values) ? values[0] : values;
    this.pendingOnConflict = opts?.onConflict ?? null;
    return this;
  }

  update(values: any) {
    this.pendingOp = 'update';
    this.pendingValues = values;
    return this;
  }

  delete() {
    this.pendingOp = 'delete';
    return this;
  }

  // ─── Execution (thenable) ───────────────────────────────────────────────────
  private async execute() {
    const op = this.pendingOp ?? 'select';
    const table = this.table;

    switch (op) {
      case 'select': {
        const query: Record<string, any> = {};
        for (const f of this.filters) {
          const key = f.operator === 'eq' ? `filter_${f.column}` : `filter_${f.operator}_${f.column}`;
          query[key] = Array.isArray(f.value) ? f.value.join(',') : f.value;
        }
        if (this.orderColumn) {
          query.order_by = this.orderColumn;
          query.order_dir = this.orderAscending ? 'asc' : 'desc';
        }
        if (this.rowLimit) query.limit = this.rowLimit;

        const { data } = await request<{ data: T[] }>(`/api/data/${table}`, { query });
        return {
          data: this.singleRow ? (data?.[0] ?? null) : data,
          error: null,
          count: data?.length,
        };
      }

      case 'insert': {
        const { data } = await request<{ data: T }>(`/api/data/${table}`, {
          method: 'POST',
          body: this.pendingValues,
        });
        return { data, error: null };
      }

      case 'upsert': {
        const { data } = await request<{ data: T }>(`/api/data/${table}/upsert`, {
          method: 'POST',
          body: this.pendingValues,
          query: { onConflict: this.pendingOnConflict ?? undefined },
        });
        return { data, error: null };
      }

      case 'update': {
        const targetId = this.filters.find(f => f.column === 'id' && f.operator === 'eq')?.value ?? this.id;
        const { data } = await request<{ data: T }>(`/api/data/${table}/${targetId}`, {
          method: 'PATCH',
          body: this.pendingValues,
        });
        return { data, error: null };
      }

      case 'delete': {
        const targetId = this.filters.find(f => f.column === 'id' && f.operator === 'eq')?.value ?? this.id;
        await request(`/api/data/${table}/${targetId}`, { method: 'DELETE' });
        return { error: null };
      }
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<any> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<any> {
    return this.execute().finally(onfinally);
  }
}

export function from(table: string) {
  return new TableQuery(table);
}

export function fromId(table: string, id: string) {
  return new TableQuery(table, id);
}

// Export a supabase-compatible object
export const supabase = {
  auth,
  from,
};

export default supabase;