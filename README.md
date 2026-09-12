# Atlas — Personal AI Secretary (PWA)

Atlas adalah versi Progressive Web App dari east3: asisten AI pribadi mobile-first yang dapat diinstal (Add to Home Screen) di Android, tetap menggunakan backend + Neon PostgreSQL yang sama, dan tetap di-deploy ke Netlify.

> Dokumentasi di bawah bagian ini adalah catatan teknis lama untuk east3 (Expo native + API). Berikut adalah ringkasan arsitektur baru.

## Arsitektur (tidak berubah, hanya di-rebrand & diperbaruhi)

```
┌──────────────────┐      ┌───────────────────────────┐      ┌─────────────┐
│  Atlas PWA       │─────▶│  Server API (Netlify Fn)   │─────▶│  Neon DB    │
│  (web/, Vite)    │      │  /api/auth, /api/data,    │      │  (Postgres) │
│  installable     │      │  /api/ai-proxy (server)   │      │  + pgvector │
└──────────────────┘      └───────────────────────────┘      └─────────────┘
```

UI tidak pernah memanggil provider AI secara langsung — semua lewat **AIProvider**
abstraksi client (`web/src/ai.ts`, interface `generate/summarize/toolCall`) yang
memanggil `/api/ai-proxy`; server memakai **OpenRouter** (satu-satunya provider,
hanya **model free** dari [model list OpenRouter](https://openrouter.ai/models?max_price=0))
met **fallback automatis**: jika satu model free rate-limited (429) / exhausted (402)
/ removed (404), server langsung memakai model free berikutnya yang tersedia, dan
als pemanggil akhir `openrouter/free` (auto-router).

## Fitur PWA (sesuai PRD)
- **Manifest**: `web/public/manifest.webmanifest` — Atlas, `standalone`, portrait, theme `#3B82F6`, background putih.
- **Ikon**: `web/public/icons/icon.svg` (SVG tunggal, dipakai untuk `any` & `maskable`).
- **Service Worker**: `web/public/sw.js` — cache app-shell; **tidak** mengalik API `/api/*`.
- **Splash / install**: Chrome Android otomatis memakai icon + nama + `theme_color` dari manifest.
- **App shell**: Top App Bar sticky → konten scroll → **FAB** → **Bottom Navigation** 5 tab
  (Home, Kalender, AI, Keuangan, Profil) dengan **FAB quick actions** (New Task/Event/Expense/Note).
- **Desktop**: app-frame 430px di tengah (looks like a phone app di layar besar, `@media min-width: 768px`).
- **Animasi 180–250 ms**: card lift, sheet slide-up, FAB rotate, progress fill, page transition.

## Halaman
- **Home**: Morning Brief (AI), timeline jadwal hari ini, kartu Income/Expense/Remaining, Workout hari ini, checklist Habit, prioritas (Quick Task).
- **Calendar**: view Hari/Minggu/Bulan + input bahasa alami (mis. “Meeting besok jam 9”, "Gym tiap Senin Rabu Jumat") yang di-parse AI jadi event.
- **AI**: chat dengan tool-calling AI (conversation, history, undo aksi).
- **Finance**: tambah cepat (<10 detik), kategori, ringkasan bulanan, cashflow chart 7 hari, indikator budget.
- **Profil**: info akun, tautan ke Workout / Habits / Second Brain, dan logout.

## Backend & Database
Lihat bagian selanjutnya dari file ini (east3 legacy docs) untuk:
- Neon schema di `db/schema.sql`
- Endpoint REST: `/api/auth/*`, `/api/data/*`, `/api/ai-proxy`
- Cara setup & deploy Netlify.

## Folder penting
- `web/` — kode PWA (React 19 + Vite) yang di-deploy ke Netlify (`netlify.toml` → `web/dist`)
- `src/` — Aplikasi ekspo native yang tetap (untuk Android/iOS native build)
- `api/` — serverless functions (auth, data, ai-proxy)
- `db/schema.sql` — schema PostgreSQL/Neon
# east3 - Personal Life OS

A comprehensive React Native (Expo) app functioning as a Personal AI Secretary to manage finances, schedule, workouts, habits, and a Second Brain, powered by OpenRouter free models and Neon PostgreSQL.

## Tech Stack
- **Frontend**: React Native (Expo), TypeScript, Zustand, React Navigation
- **Database**: Neon (PostgreSQL, pgvector)
- **Backend**: Vercel Serverless Functions (Node.js, REST API)
- **AI Models**: OpenRouter — free models only, with automatic fallback between free models (`openrouter/free` auto-router as last resort)

## Architecture

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────┐
│  Expo App       │────▶│  Vercel Serverless API   │────▶│  Neon DB    │
│  (React Native) │     │  /api/auth, /api/data,   │     │  (Postgres) │
│                 │     │  /api/ai-proxy           │     │  + pgvector │
└─────────────────┘     └──────────────────────────┘     └─────────────┘
```

The mobile app never talks to the database directly. All requests go through the Vercel API which:
1. Authenticates users via JWT (HS256)
2. Validates ownership of every row
3. Executes parameterized SQL queries against Neon
4. Keeps API keys (OpenRouter) secure on the server

## Setup Guide

### 1. Database (Neon)
1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project (choose region closest to you, e.g. Singapore)
3. Copy the connection string (it looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`)
4. Go to **SQL Editor** in Neon Dashboard
5. Run the entire script in `db/schema.sql`
6. Enable the `vector` extension if prompted (the schema does it automatically)

### 2. API (Vercel)
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy the API: `vercel`
3. Set environment variables in Vercel (Settings → Environment Variables):
   - `DATABASE_URL` — your Neon connection string
   - `OPENROUTER_API_KEY` — from [OpenRouter](https://openrouter.ai/settings/keys) (the ONLY AI provider; chat always uses free models with automatic fallback)
   - `OPENROUTER_FALLBACK_MODELS` — optional, comma-separated free-model priority order
   - `GEMINI_API_KEY` — optional, only for vector embeddings (no free OpenRouter embedding endpoint yet); without it, note search degrades to keyword search
   - `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
4. Note your deployment URL (e.g. `https://east3.vercel.app`)

### 3. App Development
1. Copy `.env.example` to `.env` and fill in:
   ```
   EXPO_PUBLIC_API_URL=https://your-app.vercel.app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app:
   ```bash
   npx expo start
   ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account (email, password, display_name) |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user profile |
| PATCH | `/api/auth/me` | Update profile |
| GET | `/api/data/:table` | List rows (with filters) |
| GET | `/api/data/:table/:id` | Get single row |
| POST | `/api/data/:table` | Insert row |
| POST | `/api/data/:table/upsert` | Upsert row (onConflict) |
| PATCH | `/api/data/:table/:id` | Update row |
| DELETE | `/api/data/:table/:id` | Delete row |
| POST | `/api/ai-proxy` | AI chat with tool calling |

### Filtering
```
GET /api/data/transactions?filter_type=expense&filter_gte_occurred_at=2026-01-01&filter_lte_occurred_at=2026-01-31&order_by=occurred_at&order_dir=desc&limit=50
```

Supported operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `ilike`, `in`

## Features
- **Smart Calendar**: Event management synced with AI copilot.
- **Finance Copilot**: Income/expense tracking with categorical budgets.
- **Workout Manager**: Push/Pull/Legs or custom splits, progress tracking, volume analytics.
- **Habit Tracker**: Daily/weekly habits with streak tracking and incremental inputs.
- **Second Brain**: Semantic note taking (Ideas, SOPs, Meetings, Journals) with pgvector.
- **AI Copilot**: 11 unique tool integrations allowing the AI to manage your app via natural language.

## Architecture Decisions
- **Zustand over Context**: Chosen for simpler, scalable state management without prop drilling.
- **Vercel Proxy**: AI keys must be secured on a backend. Node.js serverless functions on Vercel are the AI proxy.
- **Neon + pgvector**: Free PostgreSQL with native vector support for fast semantic search.
- **Custom JWT Auth**: Lightweight auth without external dependencies — HMAC-SHA256 signed tokens with per-user salt for passwords.