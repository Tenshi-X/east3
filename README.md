# east3 - Personal Life OS

A comprehensive React Native (Expo) app functioning as a Personal AI Secretary to manage finances, schedule, workouts, habits, and a Second Brain, all powered by Gemini and Neon PostgreSQL.

## Tech Stack
- **Frontend**: React Native (Expo), TypeScript, Zustand, React Navigation
- **Database**: Neon (PostgreSQL, pgvector)
- **Backend**: Vercel Serverless Functions (Node.js, REST API)
- **AI Models**: Google Gemini 2.0 Flash (Primary) & OpenRouter (Fallback)

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
4. Keeps API keys (Gemini, OpenRouter) secure on the server

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
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com)
   - `OPENROUTER_API_KEY` — from [OpenRouter](https://openrouter.ai) (optional fallback)
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