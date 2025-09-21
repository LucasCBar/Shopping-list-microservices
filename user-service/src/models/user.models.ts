import { z } from 'zod';

export const PreferencesSchema = z.object({
  defaultStore: z.string().default(''),
  currency: z.string().default('BRL'),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string(),           // hash
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  preferences: PreferencesSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export type User = z.infer<typeof UserSchema>;

export const PublicUserSchema = UserSchema.omit({ password: true });
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  preferences: PreferencesSchema.partial().optional(),
});
export type RegisterDTO = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6),
}).refine(d => !!d.email || !!d.username, { message: 'email_or_username_required' });
export type LoginDTO = z.infer<typeof LoginSchema>;

export function toPublic(u: User): PublicUser {
  return PublicUserSchema.parse(u);
}
