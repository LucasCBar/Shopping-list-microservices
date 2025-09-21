import { z } from 'zod';

export const ListItemSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string(),
  quantity: z.number().positive(),
  unit: z.enum(['kg', 'un', 'litro']),
  estimatedPrice: z.number().nonnegative(),
  purchased: z.boolean().default(false),
  notes: z.string().default(''),
  addedAt: z.number().int()
});
export type ListItem = z.infer<typeof ListItemSchema>;

export const ListSummarySchema = z.object({
  totalItems: z.number().int().nonnegative(),
  purchasedItems: z.number().int().nonnegative(),
  estimatedTotal: z.number().nonnegative()
});
export type ListSummary = z.infer<typeof ListSummarySchema>;

export const ShoppingListSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
  items: z.array(ListItemSchema),
  summary: ListSummarySchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int()
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;

export const CreateListSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});
export type CreateListDTO = z.infer<typeof CreateListSchema>;

export const UpdateListSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional()
});
export type UpdateListDTO = z.infer<typeof UpdateListSchema>;

export const AddItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
  // permite override manual do preço (senão usa averagePrice do catálogo)
  estimatedPrice: z.number().nonnegative().optional()
});
export type AddItemDTO = z.infer<typeof AddItemSchema>;

export const UpdateListItemSchema = z.object({
  quantity: z.number().positive().optional(),
  estimatedPrice: z.number().nonnegative().optional(),
  purchased: z.boolean().optional(),
  notes: z.string().optional()
});
export type UpdateListItemDTO = z.infer<typeof UpdateListItemSchema>;
