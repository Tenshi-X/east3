import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import authRouter from '../../api/auth-express';
import dataRouter from '../../api/data-express';
import aiProxyRouter from '../../api/ai-proxy-express';
import { apiTiming } from '../../api/_timing';

const app = express();

app.use(cors({ exposedHeaders: ["Server-Timing"] }));
app.use("/api", apiTiming);
app.use(express.json({ limit: '5mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'east3 API running' });
});

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api', aiProxyRouter);

export const handler = serverless(app);

