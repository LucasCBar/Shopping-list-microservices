import { Request, Response } from 'express';
import { readUsers, writeUsers } from '../repositories/user.repo';
import { toPublic } from '../models/user.models';

export async function getMe(req: Request, res: Response) {
  const { id } = (req as any).user as { id: string };
  const users = await readUsers();
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  return res.json(toPublic(u));
}

export async function updateMe(req: Request, res: Response) {
  const { id } = (req as any).user as { id: string };
  const users = await readUsers();
  const idx = users.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });

  const cur = users[idx];
  const { firstName, lastName, preferences } = req.body || {};

  const updated = {
    ...cur,
    firstName: firstName ?? cur.firstName,
    lastName: lastName ?? cur.lastName,
    preferences: {
      defaultStore: preferences?.defaultStore ?? cur.preferences.defaultStore,
      currency: preferences?.currency ?? cur.preferences.currency
    },
    updatedAt: Date.now()
  };

  users[idx] = updated;
  await writeUsers(users);
  return res.json(toPublic(updated));
}