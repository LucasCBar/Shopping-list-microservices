import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { readItems, writeItems } from '../repositories/item.repo';
import { ItemSchema, CreateItemSchema, UpdateItemSchema, type Item } from '../models/item.model';

export async function listItems(req: Request, res: Response) {
  const { category, name } = req.query as { category?: string; name?: string };
  const items = await readItems();
  let out = items.filter(i => i.active);

  if (category) out = out.filter(i => i.category === category);
  if (name) {
    const n = name.toLowerCase();
    out = out.filter(i => i.name.toLowerCase().includes(n));
  }
  return res.json(out);
}

export async function getItem(req: Request, res: Response) {
  const items = await readItems();
  const it = items.find(i => i.id === req.params.id);
  if (!it) return res.status(404).json({ error: 'not_found' });
  return res.json(it);
}

export async function createItem(req: Request, res: Response) {
  const parsed = CreateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });
  }

  const items = await readItems();
  const now = Date.now();
  const item: Item = {
    id: uuid(),
    name: parsed.data.name,
    category: parsed.data.category,
    brand: parsed.data.brand ?? '',
    unit: parsed.data.unit,
    averagePrice: parsed.data.averagePrice,
    barcode: parsed.data.barcode ?? '',
    description: parsed.data.description ?? '',
    active: parsed.data.active ?? true,
    createdAt: now
  };

  items.push(item);
  await writeItems(items);
  return res.status(201).json(item);
}

export async function updateItem(req: Request, res: Response) {
  const parsed = UpdateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });
  }
  const items = await readItems();
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });

  const cur = items[idx];
  const up = parsed.data;

  const updated: Item = {
    ...cur,
    name: up.name ?? cur.name,
    category: up.category ?? cur.category,
    brand: up.brand ?? cur.brand,
    unit: up.unit ?? cur.unit,
    averagePrice: up.averagePrice ?? cur.averagePrice,
    barcode: up.barcode ?? cur.barcode,
    description: up.description ?? cur.description,
    active: typeof up.active === 'boolean' ? up.active : cur.active
    // createdAt permanece
  };

  // valida shape final
  const validated = ItemSchema.safeParse(updated);
  if (!validated.success) {
    return res.status(400).json({ error: 'validation_error', details: validated.error.format() });
  }

  items[idx] = validated.data;
  await writeItems(items);
  return res.json(validated.data);
}
