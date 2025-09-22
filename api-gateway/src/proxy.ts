import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request, Response, NextFunction } from 'express';
import { getService } from '../../shared/serviceRegistry';
import { CircuitBreaker } from './circuitBreaker';

async function resolveBase(serviceName: string, envVar: string, fallback: string) {
  const svc = await getService(serviceName).catch(() => undefined);
  if (svc?.url) return svc.url;
  if (process.env[envVar]) return process.env[envVar]!;
  return fallback;
}

function writeBodyIfNeeded(proxyReq: any, req: Request) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  if (!req.body || !Object.keys(req.body).length) return;

  const ct = (proxyReq.getHeader('content-type') || '') as string;
  let bodyData: string | undefined;

  if (ct.includes('application/json')) {
    bodyData = JSON.stringify(req.body);
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    bodyData = new URLSearchParams(req.body as any).toString();
  } else {
    bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('content-type', 'application/json');
  }

  if (bodyData) {
    proxyReq.setHeader('content-length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
}

export function serviceProxy(options: {
  mountPath: string;   // ex: '/api/auth'
  serviceName: string; // ex: 'user-service'
  addPrefix: string;   // ex: '/auth'
  envVar?: string;
  fallback?: string;
  breaker: CircuitBreaker;
}) {
  const {
    mountPath,
    serviceName,
    addPrefix,
    envVar = 'SERVICE_URL',
    fallback = 'http://localhost:3000',
    breaker
  } = options;

  const guard = async (_req: Request, res: Response, next: NextFunction) => {
    const { allowed, reason } = breaker.allow(serviceName);
    if (!allowed) return res.status(503).json({ error: reason, service: serviceName });
    next();
  };

  return [
    guard,
    createProxyMiddleware({
      changeOrigin: true,
      pathRewrite: (path, req: Request) => {
        // use o caminho COMPLETO que chegou ao gateway (inclui o mount)
        const full = (req as any).originalUrl || path;      // ex: '/api/auth/register?x=1'
        const [pathname] = full.split('?');                 // '/api/auth/register'
        // remove o mountPath do começo, se ainda estiver presente
        const withoutMount = pathname.replace(new RegExp(`^${mountPath}`), ''); // '/register'
        // prefixa com o caminho que o serviço alvo espera
        return `${addPrefix}${withoutMount}`;               // '/auth/register'
      },
      router: async () => resolveBase(serviceName, envVar, fallback),
      onProxyReq: (proxyReq, req) => {
        if (req.headers['authorization']) {
          proxyReq.setHeader('authorization', req.headers['authorization'] as string);
        }
        writeBodyIfNeeded(proxyReq, req as Request);
      },
      onError: (_err, _req, res) => {
        breaker.failure(serviceName);
        (res as Response).status(502).json({ error: 'upstream_error', service: serviceName });
      },
      onProxyRes: (proxyRes, _req, res) => {
        const s = proxyRes.statusCode ?? 0;
        s >= 500 ? breaker.failure(serviceName) : breaker.success(serviceName);
      },
      logLevel: 'warn'
    })
  ];
}
