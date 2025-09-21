import { z } from 'zod';

export const ItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  category: z.enum(['Alimentos', 'Limpeza', 'Higiene', 'Bebidas', 'Padaria']),
  brand: z.string().default(''),
  unit: z.enum(['kg', 'un', 'litro']),
  averagePrice: z.number().nonnegative(),
  barcode: z.string().default(''),
  description: z.string().default(''),
  active: z.boolean().default(true),
  createdAt: z.number().int()
});
export type Item = z.infer<typeof ItemSchema>;

export const CreateItemSchema = ItemSchema.omit({ id: true, createdAt: true }).partial({
  brand: true,
  barcode: true,
  description: true
}).extend({
  name: z.string().min(2),
  category: z.enum(['Alimentos', 'Limpeza', 'Higiene', 'Bebidas', 'Padaria']),
  unit: z.enum(['kg', 'un', 'litro']),
  averagePrice: z.number().nonnegative()
});
export type CreateItemDTO = z.infer<typeof CreateItemSchema>;

export const UpdateItemSchema = CreateItemSchema.partial();
export type UpdateItemDTO = z.infer<typeof UpdateItemSchema>;
