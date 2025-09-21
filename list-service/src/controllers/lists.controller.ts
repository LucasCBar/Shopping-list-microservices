import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import axios from 'axios';

import { readLists, writeLists } from '../repositories/list.repo';
import {
  CreateListSchema, UpdateListSchema,
  AddItemSchema, UpdateListItemSchema,
  ShoppingListSchema, type ShoppingList, type ListItem
} from '../models/list.model';
import { getService } from '../../../shared/serviceRegistry';

const JWT_USER = (req: Request) => (req as any).user as { id: string; email: string; username: string };

// resolve base URL do Item Service (Registry → ENV → default)
async function getItemServiceBaseURL(): Promise<string> {
  try {
    const svc = await getService('item-service');
    if (svc?.url) return svc.url;
  } catch {}
  if (process.env.ITEM_SERVICE_URL) return process.env.ITEM_SERVICE_URL;
  return 'http://localhost:3003';
}

function computeSummary(items: ListItem[]) {
  const totalItems = items.length;
  const purchasedItems = items.filter(i => i.purchased).length;
  const estimatedTotal = items.reduce((acc, i) => acc + (i.quantity * i.estimatedPrice), 0);
  return { totalItems, purchasedItems, estimatedTotal };
}

// POST /lists
export async function createList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const parsed = CreateListSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });

  const lists = await readLists();
  const now = Date.now();
  const list: ShoppingList = {
    id: uuid(),
    userId: owner.id,
    name: parsed.data.name,
    description: parsed.data.description ?? '',
    status: 'active',
    items: [],
    summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 },
    createdAt: now,
    updatedAt: now
  };

  lists.push(list);
  await writeLists(lists);
  return res.status(201).json(list);
}

// GET /lists
export async function listMyLists(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const mine = lists.filter(l => l.userId === owner.id);
  return res.json(mine);
}

// GET /lists/:id
export async function getList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find(x => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });
  return res.json(l);
}

// PUT /lists/:id
export async function updateList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const parsed = UpdateListSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });

  const lists = await readLists();
  const idx = lists.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  if (lists[idx].userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  const cur = lists[idx];
  const updated: ShoppingList = {
    ...cur,
    name: parsed.data.name ?? cur.name,
    description: parsed.data.description ?? cur.description,
    status: parsed.data.status ?? cur.status,
    updatedAt: Date.now()
  };

  // valida shape final
  const validated = ShoppingListSchema.safeParse(updated);
  if (!validated.success) return res.status(400).json({ error: 'validation_error', details: validated.error.format() });

  lists[idx] = validated.data;
  await writeLists(lists);
  return res.json(validated.data);
}

// DELETE /lists/:id
export async function deleteList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const idx = lists.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  if (lists[idx].userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  const removed = lists.splice(idx, 1)[0];
  await writeLists(lists);
  return res.json({ deleted: removed.id });
}

// POST /lists/:id/items
export async function addItemToList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const parsed = AddItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });

  const lists = await readLists();
  const idx = lists.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const list = lists[idx];
  if (list.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  // chama Item Service para enriquecer dados
  const base = await getItemServiceBaseURL();
  try {
    const { data: catItem } = await axios.get(`${base}/items/${parsed.data.itemId}`);
    const now = Date.now();
    const li: ListItem = {
      itemId: parsed.data.itemId,
      itemName: catItem.name,
      quantity: parsed.data.quantity,
      unit: catItem.unit,
      estimatedPrice: parsed.data.estimatedPrice ?? catItem.averagePrice ?? 0,
      purchased: false,
      notes: parsed.data.notes ?? '',
      addedAt: now
    };

    list.items.push(li);
    list.summary = computeSummary(list.items);
    list.updatedAt = now;

    // valida lista inteira e persiste
    const validated = ShoppingListSchema.safeParse(list);
    if (!validated.success) return res.status(400).json({ error: 'validation_error', details: validated.error.format() });

    lists[idx] = validated.data;
    await writeLists(lists);
    return res.status(201).json(li);
  } catch (err: any) {
    return res.status(502).json({ error: 'item_service_unavailable', detail: err?.message });
  }
}

// PUT /lists/:id/items/:itemId
export async function updateListItem(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const parsed = UpdateListItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });

  const lists = await readLists();
  const idx = lists.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const list = lists[idx];
  if (list.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  const itemIdx = list.items.findIndex(i => i.itemId === req.params.itemId);
  if (itemIdx === -1) return res.status(404).json({ error: 'item_not_in_list' });

  const cur = list.items[itemIdx];
  const up = parsed.data;

  const updated: ListItem = {
    ...cur,
    quantity: up.quantity ?? cur.quantity,
    estimatedPrice: up.estimatedPrice ?? cur.estimatedPrice,
    purchased: typeof up.purchased === 'boolean' ? up.purchased : cur.purchased,
    notes: up.notes ?? cur.notes
  };

  list.items[itemIdx] = updated;
  list.summary = computeSummary(list.items);
  list.updatedAt = Date.now();

  const validated = ShoppingListSchema.safeParse(list);
  if (!validated.success) return res.status(400).json({ error: 'validation_error', details: validated.error.format() });

  lists[idx] = validated.data;
  await writeLists(lists);
  return res.json(updated);
}

// DELETE /lists/:id/items/:itemId
export async function removeListItem(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const idx = lists.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const list = lists[idx];
  if (list.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  const itemIdx = list.items.findIndex(i => i.itemId === req.params.itemId);
  if (itemIdx === -1) return res.status(404).json({ error: 'item_not_in_list' });

  list.items.splice(itemIdx, 1);
  list.summary = computeSummary(list.items);
  list.updatedAt = Date.now();

  const validated = ShoppingListSchema.safeParse(list);
  if (!validated.success) return res.status(400).json({ error: 'validation_error', details: validated.error.format() });

  lists[idx] = validated.data;
  await writeLists(lists);
  return res.json({ removed: req.params.itemId, summary: list.summary });
}

// GET /lists/:id/summary
export async function getListSummary(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find(x => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });
  // recalcula on-the-fly para garantir consistência
  const summary = computeSummary(l.items);
  if (JSON.stringify(summary) !== JSON.stringify(l.summary)) {
    l.summary = summary;
    l.updatedAt = Date.now();
    await writeLists(lists);
  }
  return res.json(summary);
}
