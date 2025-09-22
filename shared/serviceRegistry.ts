// shared/serviceRegistry.ts
import fs from 'fs/promises';
import path from 'path';

// ---- Tipos ----
export type ServiceEntry = {
  name: string;
  url: string;
  healthPath?: string;
  lastSeen: number; // epoch ms
};

const REGISTRY_FILE = path.resolve(__dirname, '../registry/services.json');

// ---- Utils de arquivo ----
async function load(): Promise<Record<string, ServiceEntry>> {
  try {
    const txt = await fs.readFile(REGISTRY_FILE, 'utf8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}
async function save(reg: Record<string, ServiceEntry>) {
  await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(reg, null, 2), 'utf8');
}

// ---- API principal ----
export async function registerService(opts: { name: string; url: string; healthPath?: string }) {
  const reg = await load();
  reg[opts.name] = {
    name: opts.name,
    url: opts.url,
    healthPath: opts.healthPath ?? '/health',
    lastSeen: Date.now(),
  };
  await save(reg);
}

export async function heartbeatService(name: string) {
  const reg = await load();
  const e = reg[name];
  if (!e) return;
  e.lastSeen = Date.now();
  await save(reg);
}

export async function deregisterService(name: string) {
  const reg = await load();
  if (reg[name]) {
    delete reg[name];
    await save(reg);
  }
}

export async function getService(name: string) {
  const reg = await load();
  return reg[name];
}
export async function getAllServices() {
  return load();
}

// Node 18+ tem fetch global
export async function healthCheckAll() {
  const reg = await load();
  const entries = Object.values(reg);
  const result: Record<string, any> = {};
  await Promise.all(
    entries.map(async (s) => {
      const url = s.url.replace(/\/+$/, '') + (s.healthPath ?? '/health');
      try {
        const r = await fetch(url, { method: 'GET', headers: { accept: 'application/json' }, cache: 'no-store' });
        result[s.name] = { ok: r.ok, status: r.status, url: s.url, healthPath: s.healthPath ?? '/health' };
      } catch (e: any) {
        result[s.name] = { ok: false, error: String(e?.message || e), url: s.url, healthPath: s.healthPath ?? '/health' };
      }
    })
  );
  return result;
}

/** Auto-registro com heartbeat e cleanup automático em SIGINT/SIGTERM/exit. */
export function startAutoRegistry(opts: {
  name: string;
  url: string;
  healthPath?: string;
  heartbeatMs?: number; // default 30s
}) {
  const { name, url, healthPath = '/health', heartbeatMs = 30_000 } = opts;
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const start = async () => {
    await registerService({ name, url, healthPath });
    timer = setInterval(() => heartbeatService(name).catch(() => {}), heartbeatMs);
  };
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
    await deregisterService(name).catch(() => {});
  };

  // cleanup automático
  process.on('SIGINT', () => { stop().finally(() => process.exit(0)); });
  process.on('SIGTERM', () => { stop().finally(() => process.exit(0)); });
  process.on('exit', () => { if (!stopped) { /* best-effort sync not guaranteed */ } });

  // inicia já
  start().catch(() => {});

  return { stop };
}
