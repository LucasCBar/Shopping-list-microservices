import fs from 'fs/promises';
import path from 'path';

export class JsonDatabase<T = unknown> {
  private filePath: string;
  private _lock = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async ensureFile() {
    try { await fs.access(this.filePath); }
    catch {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, '[]', 'utf-8');
    }
  }

  async read(): Promise<T[]> {
    await this.ensureFile();
    const txt = await fs.readFile(this.filePath, 'utf-8');
    try { return JSON.parse(txt || '[]') as T[]; }
    catch { return []; }
  }

  async write(data: T[]): Promise<void> {
    // lock simples para evitar escrita concorrente
    while (this._lock) await new Promise(r => setTimeout(r, 10));
    this._lock = true;
    try {
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
    } finally {
      this._lock = false;
    }
  }
}
