import express, { type RequestHandler } from 'express';
import cors from 'cors';
import morgan from 'morgan';

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

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, async () => {
  await registerService({ name: 'user-service', url: `http://localhost:${PORT}`, healthPath: '/health' });
  console.log(`user-service on :${PORT}`);
});

export default app;
