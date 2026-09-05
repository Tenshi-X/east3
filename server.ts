import express from 'express';
import cors from 'cors';
import authRouter from './api/auth-express';
import dataRouter from './api/data-express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'east3 API running' });
});

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
