import { Router } from 'express';
import { listItems, getItem, createItem, updateItem } from '../controllers/items.controller';

const router = Router();

// públicos
router.get('/', listItems);
router.get('/:id', getItem);

// agora também PÚBLICOS (sem JWT)
router.post('/', createItem);
router.put('/:id', updateItem);

export default router;
