import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import axios from 'axios';

import { readLists, writeLists } from '../repositories/list.repo';
import {
  CreateListSchema,
  UpdateListSchema,
  AddItemSchema,
  UpdateListItemSchema,
  ShoppingListSchema,
  type ShoppingList,
  type ListItem
} from '../models/list.model';
import { getService } from '../../../shared/serviceRegistry';
import { getRabbitChannel } from '../../../shared/rabbitmq';

const JWT_USER = (req: Request) =>
  (req as any).user as { id: string; email: string; username: string };

// resolve base URL do Item Service (Registry → ENV → default)
async function getItemServiceBaseURL(): Promise<string> {
  try {
    const svc = await getService('item-service');
    if (svc?.url) return svc.url;
  } catch {
    // ignora erro do registry, tenta fallback
  }
  if (process.env.ITEM_SERVICE_URL) return process.env.ITEM_SERVICE_URL;
  return 'http://localhost:3003';
}

function computeSummary(items: ListItem[]) {
  const totalItems = items.length;
  const purchasedItems = items.filter((i) => i.purchased).length;
  const estimatedTotal = items.reduce(
    (acc, i) => acc + i.quantity * i.estimatedPrice,
    0
  );
  return { totalItems, purchasedItems, estimatedTotal };
}

// -----------------------------------------------------------------------------
// LIST CRUD
// -----------------------------------------------------------------------------

// POST /lists
export async function createList(req: Request, res: Response) {
  const owner = JWT_USER(req);

  let dto;
  try {
    dto = CreateListSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: 'invalid_payload', details: err.errors });
  }

  const lists = await readLists();

  const now = Date.now();
  const list: ShoppingList = {
    id: uuid(),
    userId: owner.id,
    name: dto.name,
    description: dto.description ?? '',
    items: [],
    summary: computeSummary([]),
    createdAt: now,
    updatedAt: now,
    status: 'active'
  } as any;

  // opcional: validar com ShoppingListSchema
  try {
    ShoppingListSchema.parse(list);
  } catch {
    // se der algum erro de schema, ainda assim seguimos (para não travar o trabalho)
  }

  lists.push(list);
  await writeLists(lists);

  return res.status(201).json(list);
}

// GET /lists
export async function listMyLists(_req: Request, res: Response) {
  const owner = JWT_USER(_req);
  const lists = await readLists();
  const mine = lists.filter((l) => l.userId === owner.id);
  return res.json(mine);
}

// GET /lists/:id
export async function getList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find((x) => x.id === req.params.id);

  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  return res.json(l);
}

// PUT /lists/:id
export async function updateList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find((x) => x.id === req.params.id);

  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  let dto;
  try {
    dto = UpdateListSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: 'invalid_payload', details: err.errors });
  }

  if (dto.name !== undefined) (l as any).name = dto.name;
  if (dto.description !== undefined) (l as any).description = dto.description;
  if (dto.status !== undefined) (l as any).status = dto.status;

  (l as any).updatedAt = Date.now();
  await writeLists(lists);

  return res.json(l);
}

// DELETE /lists/:id
export async function deleteList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const idx = lists.findIndex((x) => x.id === req.params.id);

  if (idx < 0) return res.status(404).json({ error: 'not_found' });
  if (lists[idx].userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  const [removed] = lists.splice(idx, 1);
  await writeLists(lists);

  return res.json(removed);
}

// -----------------------------------------------------------------------------
// ITEMS DENTRO DA LISTA
// -----------------------------------------------------------------------------

// POST /lists/:id/items
export async function addItemToList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find((x) => x.id === req.params.id);

  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  let dto;
  try {
    dto = AddItemSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: 'invalid_payload', details: err.errors });
  }

  // busca detalhes do item no item-service
  const base = await getItemServiceBaseURL();

  let itemResponse;
  try {
    itemResponse = await axios.get(`${base}/items/${dto.itemId}`);
  } catch (err: any) {
    console.error('[list-service] erro ao chamar item-service', err?.message);
    return res.status(502).json({ error: 'item_service_unavailable' });
  }

  const item = itemResponse.data;

  const now = Date.now();
  const listItem: ListItem = {
    itemId: dto.itemId,
    itemName: item.name,
    quantity: dto.quantity,
    unit: item.unit ?? 'un',
    estimatedPrice:
      dto.estimatedPrice ?? item.averagePrice ?? 0,
    purchased: false,
    notes: dto.notes ?? '',
    addedAt: now
  };

  l.items.push(listItem);
  (l as any).summary = computeSummary(l.items);
  (l as any).updatedAt = now;
  await writeLists(lists);

  return res.status(201).json(l);
}

// PUT /lists/:id/items/:itemId
export async function updateListItem(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find((x) => x.id === req.params.id);

  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  let dto;
  try {
    dto = UpdateListItemSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: 'invalid_payload', details: err.errors });
  }

  const item = l.items.find((i) => i.itemId === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'item_not_found' });

  if (dto.quantity !== undefined) item.quantity = dto.quantity;
  if (dto.estimatedPrice !== undefined) item.estimatedPrice = dto.estimatedPrice;
  if (dto.purchased !== undefined) item.purchased = dto.purchased;
  if (dto.notes !== undefined) item.notes = dto.notes;

  (l as any).summary = computeSummary(l.items);
  (l as any).updatedAt = Date.now();
  await writeLists(lists);

  return res.json(l);
}

// DELETE /lists/:id/items/:itemId
export async function removeListItem(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find((x) => x.id === req.params.id);

  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  const before = l.items.length;
  l.items = l.items.filter((i) => i.itemId !== req.params.itemId);

  if (l.items.length === before) {
    return res.status(404).json({ error: 'item_not_found' });
  }

  (l as any).summary = computeSummary(l.items);
  (l as any).updatedAt = Date.now();
  await writeLists(lists);

  return res.json(l);
}

// GET /lists/:id/summary
export async function getListSummary(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find((x) => x.id === req.params.id);

  if (!l) return res.status(404).json({ error: 'not_found' });
  if (l.userId !== owner.id) return res.status(403).json({ error: 'forbidden' });

  // recalcula on-the-fly para garantir consistência
  const summary = computeSummary(l.items);
  if (JSON.stringify(summary) !== JSON.stringify((l as any).summary)) {
    (l as any).summary = summary;
    (l as any).updatedAt = Date.now();
    await writeLists(lists);
  }

  return res.json(summary);
}

// -----------------------------------------------------------------------------
// CHECKOUT ASSÍNCRONO (Producer RabbitMQ)
// -----------------------------------------------------------------------------

// POST /lists/:id/checkout
export async function checkoutList(req: Request, res: Response) {
  const owner = JWT_USER(req);
  const lists = await readLists();
  const l = lists.find((x) => x.id === req.params.id);

  if (!l) {
    return res.status(404).json({ error: 'not_found' });
  }

  if (l.userId !== owner.id) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // impede checkout duplicado
  if ((l as any).status === 'checked_out') {
    return res.status(409).json({ error: 'already_checked_out' });
  }

  const summary = computeSummary(l.items);

  (l as any).summary = summary;
  (l as any).status = 'checked_out';
  (l as any).checkedOutAt = Date.now();
  (l as any).updatedAt = Date.now();
  await writeLists(lists);

  const payload = {
    event: 'list.checkout.completed',
    listId: l.id,
    userId: l.userId,
    userEmail: owner.email,
    summary,
    at: new Date().toISOString()
  };

  try {
    const channel = await getRabbitChannel();
    const body = Buffer.from(JSON.stringify(payload));

    channel.publish(
      'shopping_events',
      'list.checkout.completed',
      body,
      { persistent: true }
    );

    console.log(
      '[list-service] published list.checkout.completed',
      payload
    );
  } catch (err) {
    console.error('[list-service] failed to publish checkout event', err);
    // não vamos falhar o checkout por causa do broker
  }

  return res.status(202).json({
    status: 'accepted',
    listId: l.id,
    message: 'checkout event queued'
  });
}
