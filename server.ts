import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import authRouter from './api/auth-express';
import dataRouter from './api/data-express';
import aiProxyRouter from './api/ai-proxy-express';

// ─── Load local `.env` for development (dependency-free) ─────────────────────
// Netlify/Vercel inject environment variables themselves in production; this only
// helps `npm run dev`. Values already present in the environment are never
// overwritten.
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
} catch {
  /* no .env — rely on environment variables */
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'east3 API running' });
});

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api', aiProxyRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
