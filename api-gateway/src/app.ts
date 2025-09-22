import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import axios from 'axios';

import { serviceProxy } from './proxy';
import { CircuitBreaker } from './circuitBreaker';
import { authMiddleware } from '../../shared/jwt';
import { getAllServices, healthCheckAll } from '../../shared/serviceRegistry';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const breaker = new CircuitBreaker({ threshold: 3, timeoutMs: 30000 });

// --------- Health & Registry ----------
let lastHealth: any = {};
async function runHealthCheck() {
  try { lastHealth = await healthCheckAll(); } catch {}
}
setInterval(runHealthCheck, 30_000);
runHealthCheck();

app.get('/health', async (_req, res) => {
  // retorna snapshot mais atual + estado dos circuitos
  res.json({ gateway: 'UP', circuits: breaker.status(), services: lastHealth });
});

app.get('/registry', async (_req, res) => {
  const regs = await getAllServices();
  res.json(regs);
});

// --------- Proxy Routes (/api/*) ----------
// /api/auth/*  → user-service
app.use(
  '/api/auth',
  ...serviceProxy({
    mountPath: '/api/auth',
    serviceName: 'user-service',
    addPrefix: '/auth',
    envVar: 'USER_SERVICE_URL',
    fallback: 'http://localhost:3001',
    breaker
  })
);

// /api/users/* → user-service (/users/*)
app.use(
  '/api/users',
  ...serviceProxy({
    mountPath: '/api/users',
    serviceName: 'user-service',
    addPrefix: '/users',
    envVar: 'USER_SERVICE_URL',
    fallback: 'http://localhost:3001',
    breaker
  })
);

// /api/items/* → item-service (/items/*)
app.use(
  '/api/items',
  ...serviceProxy({
    mountPath: '/api/items',
    serviceName: 'item-service',
    addPrefix: '/items',
    envVar: 'ITEM_SERVICE_URL',
    fallback: 'http://localhost:3003',
    breaker
  })
);

// /api/lists/* → list-service (/lists/*)
app.use(
  '/api/lists',
  ...serviceProxy({
    mountPath: '/api/lists',
    serviceName: 'list-service',
    addPrefix: '/lists',
    envVar: 'LIST_SERVICE_URL',
    fallback: 'http://localhost:3002',
    breaker
  })
);

// --------- Endpoints Agregados ----------

// GET /api/dashboard  (requer JWT)
// - consolida estatísticas do usuário: totalLists, totalItems, purchasedItems, estimatedTotal
app.get('/api/dashboard', authMiddleware(JWT_SECRET) as any, async (req, res) => {
  const user = (req as any).user as { id: string; email: string };
  // chama list-service /lists (do próprio user)
  const base = process.env.LIST_SERVICE_URL || 'http://localhost:3002';
  try {
    const { data: lists } = await axios.get(`${base}/lists`, {
      headers: { authorization: req.headers.authorization || '' }
    });

    const out = lists.reduce(
      (acc: any, l: any) => {
        acc.totalLists += 1;
        acc.totalItems += (l.items?.length ?? 0);
        acc.purchasedItems += (l.items?.filter((i: any) => i.purchased).length ?? 0);
        acc.estimatedTotal += (l.summary?.estimatedTotal ?? 0);
        return acc;
      },
      { userId: user.id, totalLists: 0, totalItems: 0, purchasedItems: 0, estimatedTotal: 0 }
    );

    // opcional: top 5 listas recentes
    const recent = [...lists]
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      .slice(0, 5)
      .map((l: any) => ({ id: l.id, name: l.name, total: l.summary?.estimatedTotal ?? 0, items: l.items?.length ?? 0 }));

    return res.json({ ...out, recentLists: recent });
  } catch (err: any) {
    return res.status(502).json({ error: 'list_service_unavailable', detail: err?.message });
  }
});

// GET /api/search?q=termo  (busca global: itens + listas do usuário)
// - itens: item-service /search
// - listas: filtra por nome e por itens que contenham o termo
app.get('/api/search', authMiddleware(JWT_SECRET) as any, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ items: [], lists: [] });

  const AUTH = { authorization: req.headers.authorization || '' };
  const itemBase = process.env.ITEM_SERVICE_URL || 'http://localhost:3003';
  const listBase = process.env.LIST_SERVICE_URL || 'http://localhost:3002';

  try {
    const [itemsResp, listsResp] = await Promise.all([
      axios.get(`${itemBase}/search`, { params: { q }, headers: AUTH }),
      axios.get(`${listBase}/lists`, { headers: AUTH })
    ]);

    const items = itemsResp.data ?? [];
    const listsAll = listsResp.data ?? [];

    const lists = listsAll
      .filter((l: any) =>
        (l.name?.toLowerCase().includes(q)) ||
        (l.items ?? []).some((it: any) => it.itemName?.toLowerCase().includes(q))
      )
      .map((l: any) => ({ id: l.id, name: l.name, items: l.items?.length ?? 0, estimatedTotal: l.summary?.estimatedTotal ?? 0 }));

    res.json({ items, lists });
  } catch (err: any) {
    return res.status(502).json({ error: 'search_failed', detail: err?.message });
  }
});

// ------------- start -------------
app.listen(PORT, () => {
  console.log(`api-gateway on :${PORT}`);
});
