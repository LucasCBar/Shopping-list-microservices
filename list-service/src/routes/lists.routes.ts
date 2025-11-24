import { Router, type RequestHandler } from 'express';
import {
  createList,
  listMyLists,
  getList,
  updateList,
  deleteList,
  addItemToList,
  updateListItem,
  removeListItem,
  getListSummary,
  checkoutList
} from '../controllers/lists.controller';
import { authMiddleware } from '../../../shared/jwt';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const requireAuth: RequestHandler =
  authMiddleware(JWT_SECRET) as unknown as RequestHandler;

router.post('/', requireAuth, createList);
router.get('/', requireAuth, listMyLists);
router.get('/:id', requireAuth, getList);
router.put('/:id', requireAuth, updateList);
router.delete('/:id', requireAuth, deleteList);

router.post('/:id/items', requireAuth, addItemToList);
router.put('/:id/items/:itemId', requireAuth, updateListItem);
router.delete('/:id/items/:itemId', requireAuth, removeListItem);

router.get('/:id/summary', requireAuth, getListSummary);

// 🔹 novo endpoint assíncrono de finalização
router.post('/:id/checkout', requireAuth, checkoutList);

export default router;
