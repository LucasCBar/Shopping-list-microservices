import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { startAutoRegistry } from '../../shared/serviceRegistry';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import { registerService } from '../../shared/serviceRegistry';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'user-service' }));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);

/** Error handler p/ aborts do body, payload grande e JSON inválido */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const aborted = err?.type === 'aborted' || err?.message === 'request aborted';
  const tooLarge = err?.type === 'entity.too.large';
  const parseFailed = err?.type === 'entity.parse.failed';

  if (aborted) {
    if (!res.headersSent) return res.status(400).json({ error: 'request_aborted' });
    return;
  }
  if (tooLarge) return res.status(413).json({ error: 'payload_too_large' });
  if (parseFailed) return res.status(400).json({ error: 'invalid_json' });
  return res.status(400).json({ error: 'bad_request', detail: err?.message || 'unknown' });
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, async () => {
  await registerService({ name: 'user-service', url: `http://localhost:${PORT}`, healthPath: '/health' });
  startAutoRegistry({ name: 'user-service', url: `http://localhost:${PORT}`, healthPath: '/health' });
  console.log(`user-service on :${PORT}`);
});

export default app;
