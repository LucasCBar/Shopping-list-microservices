import { Request, Response } from 'express';
import { readItems } from '../repositories/item.repo';

export async function listCategories(_req: Request, res: Response) {
  const items = await readItems();
  const cats = Array.from(new Set(items.map((i: { category: any; }) => i.category))).sort();
  return res.json(cats);
}

export async function searchItems(req: Request, res: Response) {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const items = await readItems();
  const hits = items.filter((i: { active: any; name: string; }) => i.active && i.name.toLowerCase().includes(q));
  return res.json(hits);
}
