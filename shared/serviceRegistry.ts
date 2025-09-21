import fs from 'fs/promises';
import path from 'path';
import http from 'http';

type ServiceEntry = {
  url: string;
  health: string;
  lastStatus: 'UNKNOWN' | 'UP' | 'DOWN';
  lastChecked: number;
  latencyMs?: number | null;
};

const REGISTRY_FILE = path.resolve(process.cwd(), 'registry/services.json');

async function ensureRegistryFile() {
  try { await fs.access(REGISTRY_FILE); }
  catch {
    await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
    await fs.writeFile(REGISTRY_FILE, JSON.stringify({}, null, 2));
  }
}

export async function registerService({ name, url, healthPath = '/health' }:
  { name: string; url: string; healthPath?: string; }): Promise<void> {
  await ensureRegistryFile();
  const raw = await fs.readFile(REGISTRY_FILE, 'utf-8');
  const reg = raw ? JSON.parse(raw) as Record<string, ServiceEntry> : {};
  reg[name] = { url, health: healthPath, lastStatus: 'UNKNOWN', lastChecked: 0 };
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(reg, null, 2));

  const onExit = async () => {
    try {
      const raw2 = await fs.readFile(REGISTRY_FILE, 'utf-8');
      const reg2 = raw2 ? JSON.parse(raw2) as Record<string, ServiceEntry> : {};
      if (reg2[name]) delete reg2[name];
      await fs.writeFile(REGISTRY_FILE, JSON.stringify(reg2, null, 2));
    } catch {}
  };
  process.on('SIGINT', () => { onExit().finally(() => process.exit(0)); });
  process.on('SIGTERM', () => { onExit().finally(() => process.exit(0)); });
}

export async function getService(name: string): Promise<ServiceEntry | undefined> {
  await ensureRegistryFile();
  const raw = await fs.readFile(REGISTRY_FILE, 'utf-8');
  const reg = raw ? JSON.parse(raw) as Record<string, ServiceEntry> : {};
  return reg[name];
}

export async function getAllServices(): Promise<Record<string, ServiceEntry>> {
  await ensureRegistryFile();
  const raw = await fs.readFile(REGISTRY_FILE, 'utf-8');
  return raw ? JSON.parse(raw) as Record<string, ServiceEntry> : {};
}

export async function healthCheckAll(): Promise<Record<string, ServiceEntry>> {
  await ensureRegistryFile();
  const raw = await fs.readFile(REGISTRY_FILE, 'utf-8');
  const reg = raw ? JSON.parse(raw) as Record<string, ServiceEntry> : {};
  const names = Object.keys(reg);
  await Promise.all(names.map(async (n) => {
    const svc = reg[n];
    const started = Date.now();
    try {
      await ping(`${svc.url}${svc.health}`);
      svc.lastStatus = 'UP';
      svc.latencyMs = Date.now() - started;
      svc.lastChecked = Date.now();
    } catch {
      svc.lastStatus = 'DOWN';
      svc.latencyMs = null;
      svc.lastChecked = Date.now();
    }
  }));
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(reg, null, 2));
  return reg;
}

function ping(url: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      res.statusCode && res.statusCode < 500 ? resolve(true) : reject(new Error('bad status'));
    });
    req.setTimeout(2000, () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}
