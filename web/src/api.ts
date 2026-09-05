const TOKEN_KEY = 'east3_token';
const USER_KEY = 'east3_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function loadUser(): any {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}
export function saveUser(u: any) {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(USER_KEY);
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }

  if (res.status === 401 && !path.includes('/api/auth/')) {
    setToken(null);
    saveUser(null);
    window.location.href = '/login';
    return;
  }
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

export const api = {
  register: (email: string, password: string, display_name?: string) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, display_name }) }),
  login: (email: string, password: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/api/auth/me'),

  list: (table: string, params: Record<string, string> = {}) =>
    request(`/api/data/${table}?${new URLSearchParams(params).toString()}`),
  create: (table: string, data: any) =>
    request(`/api/data/${table}`, { method: 'POST', body: JSON.stringify(data) }),
  upsert: (table: string, data: any, onConflict: string) =>
    request(`/api/data/${table}/upsert`, {
      method: 'POST',
      body: JSON.stringify({ row: data, on_conflict: onConflict }),
    }),
  update: (table: string, id: string, data: any) =>
    request(`/api/data/${table}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (table: string, id: string) =>
    request(`/api/data/${table}/${id}`, { method: 'DELETE' }),

  aiChat: (message: string, conversation_id: string) =>
    request('/api/ai-proxy', { method: 'POST', body: JSON.stringify({ message, conversation_id }) }),
  morningBrief: (date: string) =>
    request('/api/ai-proxy', { method: 'POST', body: JSON.stringify({ action: 'morning_brief', date }) }),
  semanticSearch: (query: string) =>
    request('/api/ai-proxy', { method: 'POST', body: JSON.stringify({ action: 'search_notes', query }) }),
};

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

export function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export function timeOf(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
