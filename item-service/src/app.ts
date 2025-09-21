import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import itemsRoutes from './routes/items.routes';
import catalogRoutes from './routes/catalog.routes';
import { registerService } from '../../shared/serviceRegistry';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'item-service' }));

app.use('/items', itemsRoutes);
app.use('/', catalogRoutes); // /categories, /search

const PORT = Number(process.env.PORT) || 3003;

app.listen(PORT, async () => {
  await registerService({ name: 'item-service', url: `http://localhost:${PORT}`, healthPath: '/health' });
  console.log(`item-service on :${PORT}`);
});

export default app;
