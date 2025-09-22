import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { startAutoRegistry } from '../../shared/serviceRegistry';

import listsRoutes from './routes/lists.routes';
import { registerService } from '../../shared/serviceRegistry';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'list-service' }));
app.use('/lists', listsRoutes);

const PORT = Number(process.env.PORT) || 3002;

app.listen(PORT, async () => {
  await registerService({ name: 'list-service', url: `http://localhost:${PORT}`, healthPath: '/health' });
  startAutoRegistry({ name: 'list-service', url: `http://localhost:${PORT}`, healthPath: '/health' });
  console.log(`list-service on :${PORT}`);
});

export default app;
