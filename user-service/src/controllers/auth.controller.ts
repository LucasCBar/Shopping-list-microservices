import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

import { signJwt } from '../../../shared/jwt';
import { readUsers, writeUsers } from '../repositories/user.repo';
import { RegisterSchema, LoginSchema, toPublic, type User } from '../models/user.models';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

export async function register(req: Request, res: Response) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });
  }
  const dto = parsed.data;

  const users = await readUsers();
  if (users.find(u => u.email === dto.email)) {
    return res.status(409).json({ error: 'email_in_use' });
  }

  const now = Date.now();
  const hash = await bcrypt.hash(dto.password, 10);

  const user: User = {
    id: uuid(),
    email: dto.email,
    username: dto.username,
    password: hash,
    firstName: dto.firstName ?? '',
    lastName: dto.lastName ?? '',
    preferences: {
      defaultStore: dto.preferences?.defaultStore ?? '',
      currency: dto.preferences?.currency ?? 'BRL'
    },
    createdAt: now,
    updatedAt: now
  };

  users.push(user);
  await writeUsers(users);

  return res.status(201).json(toPublic(user));
}

export async function login(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });
  }
  const dto = parsed.data;

  const users = await readUsers();
  const user = users.find(u =>
    (dto.email && u.email === dto.email) ||
    (dto.username && u.username === dto.username)
  );
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(dto.password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  
  const token = signJwt({ sub: user.id, email: user.email, username: user.username } as any, JWT_SECRET, 21600);

  return res.json({ token });
}
