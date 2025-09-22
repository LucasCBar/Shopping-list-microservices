type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

type Entry = {
  state: State;
  failures: number;
  nextTryAt: number; // epoch ms
};

export class CircuitBreaker {
  private readonly threshold: number;
  private readonly timeoutMs: number;
  private map = new Map<string, Entry>();

  constructor(opts?: { threshold?: number; timeoutMs?: number }) {
    this.threshold = opts?.threshold ?? 3;
    this.timeoutMs = opts?.timeoutMs ?? 30000; // 30s
  }

  allow(name: string): { allowed: boolean; reason?: string } {
    const e = this.map.get(name);
    if (!e) return { allowed: true };
    if (e.state === 'CLOSED') return { allowed: true };
    const now = Date.now();
    if (e.state === 'OPEN') {
      if (now >= e.nextTryAt) {
        // tenta HALF_OPEN (permitir uma requisição de teste)
        e.state = 'HALF_OPEN';
        this.map.set(name, e);
        return { allowed: true };
      }
      return { allowed: false, reason: 'circuit_open' };
    }
    if (e.state === 'HALF_OPEN') {
      // permite uma por vez; aqui simplificamos permitindo (controle leve)
      return { allowed: true };
    }
    return { allowed: true };
  }

  success(name: string) {
    this.map.set(name, { state: 'CLOSED', failures: 0, nextTryAt: 0 });
  }

  failure(name: string) {
    const e = this.map.get(name) ?? { state: 'CLOSED', failures: 0, nextTryAt: 0 };
    e.failures += 1;
    if (e.failures >= this.threshold) {
      e.state = 'OPEN';
      e.nextTryAt = Date.now() + this.timeoutMs;
    }
    this.map.set(name, e);
  }

  forceClose(name: string) {
    this.map.set(name, { state: 'CLOSED', failures: 0, nextTryAt: 0 });
  }

  status() {
    const out: Record<string, Entry> = {};
    for (const [k, v] of this.map.entries()) out[k] = v;
    return out;
  }
}
