# Atlas — Personal AI Secretary (PWA)

Atlas adalah Progressive Web App dari east3: asisten AI pribadi mobile-first yang dapat diinstal (Add to Home Screen) di Android, menggunakan backend Express + Neon PostgreSQL, dan di-deploy sebagai satu project Vercel dengan dua services.

> Dokumentasi di bawah bagian ini adalah catatan teknis lama untuk east3 (Expo native + API). Berikut adalah ringkasan arsitektur baru.

## Arsitektur (tidak berubah, hanya di-rebrand & diperbaruhi)

```
┌──────────────────┐      ┌───────────────────────────┐      ┌─────────────┐
│  Atlas PWA       │─────▶│  Server API (Vercel)       │─────▶│  Neon DB    │
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
- Cara setup & deploy Vercel Services.

## Folder penting
- `web/` — kode PWA (React 19 + Vite), serta project Android Capacitor
- `server.ts` — entrypoint Express untuk service `app`
- `api/` — handler auth, data, ai-proxy, dan akses database
- `vercel.json` — build dan routing kedua services
- `netlify.toml`, `netlify/functions/` — konfigurasi deployment Netlify lama, disimpan untuk rollback
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

### 2. Deploy PWA + API (Vercel Services)
1. Import repository ini di Vercel. Pilih **Root Directory `.`**, bukan `web`; konfigurasi kedua services ada di `vercel.json`.
2. Services dibangun terpisah: `app` (Express, `server.ts`) dan `web` (Vite, hasil build `web/dist`). Build masing-masing memakai `npm run build`; pengaturan build ada pada services, bukan di tingkat atas.
3. Salin environment variables dari project Netlify ke Vercel (Settings → Environment Variables), untuk Production dan Preview sesuai kebutuhan:
   - `DATABASE_URL` — your Neon connection string
   - `OPENROUTER_API_KEY` — from [OpenRouter](https://openrouter.ai/settings/keys) (the ONLY AI provider; chat always uses free models with automatic fallback)
   - `OPENROUTER_FALLBACK_MODELS` — optional, comma-separated free-model priority order
   - `GEMINI_API_KEY` — optional, only for vector embeddings (no free OpenRouter embedding endpoint yet); without it, note search degrades to keyword search
   - `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
4. Gunakan **DATABASE_URL dan JWT_SECRET yang sama** seperti Netlify agar data dan token akun tetap kompatibel. Jangan menjalankan ulang schema pada database yang sudah berisi data.
5. Deploy lalu verifikasi `/`, `/login`, `/calendar`, aset `/assets/*`, serta login dan `/api/auth/me`. Browser memakai `/api/*` pada domain deployment yang sama, sehingga `VITE_API_URL` tidak perlu diisi untuk PWA. Hapus nilai `VITE_API_URL` lama yang menunjuk Netlify jika ada.
6. Setelah verifikasi berhasil, pindahkan domain custom ke project Vercel jika memakai domain sendiri. PWA yang dipasang dari domain `netlify.app` perlu dibuka/dipasang ulang dari domain Vercel; penyimpanan login browser terpisah antar domain.

Routing publik:
- `/api` dan `/api/*` → `app`. Prefix `/api` tetap diterima oleh Express.
- Semua path lainnya → `web`; fallback `/index.html` mendukung navigasi React Router.
- Fallback frontend hanya mengambil path halaman; file dengan ekstensi, direktori aset/ikon, serta path modul Vite tetap dilayani langsung. `devCommand` memakai script npm dan port dari Vercel agar dapat dijalankan di Windows.
- Tidak ada service khusus internal dan tidak ada service binding. `web` adalah aplikasi statis yang memanggil API dari browser, bukan fungsi server. Binding hanya tersedia pada functions saat runtime; Neon dan OpenRouter merupakan layanan eksternal.

Referensi: [Vercel Services](https://vercel.com/docs/services), [routing](https://vercel.com/docs/services/routing), [bindings](https://vercel.com/docs/services/bindings).

### 3. Development lokal
Gunakan Node.js 22.9+ atau 24. Install dependency di kedua folder:

```bash
npm ci
npm ci --prefix web
```

Buat `.env` di root dengan environment backend di atas, lalu jalankan kedua services beserta routing Vercel:

```bash
vercel dev --local
```

Mode lokal tidak mengambil environment dari dashboard. Untuk memakai project yang sudah ditautkan beserta environment Development, jalankan `vercel dev`.

Alternatif development biasa: jalankan `npm run dev` di root dan `npm run dev --prefix web` pada terminal kedua. Proxy Vite ke `localhost:3000` hanya dipakai pada mode development ini.

Validasi build:

```bash
npm run build
npm run build --prefix web
```

### 4. Android (Capacitor)
Sebelum build Android, isi URL **publik** deployment Vercel yang sebenarnya melalui environment `VITE_API_URL` atau file `web/.env.local`:

```dotenv
VITE_API_URL=https://your-project.vercel.app
```

Gunakan origin tanpa akhiran `/api`. Ini pengaturan build frontend, bukan service binding. URL Vercel tidak ditebak oleh kode. Setelah mengisi nilainya, build ulang frontend, jalankan `npx cap sync android` dari folder `web`, lalu build/pasang ulang Android.

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
