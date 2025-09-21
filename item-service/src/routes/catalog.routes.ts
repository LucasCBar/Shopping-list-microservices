import { Router } from 'express';
import { listCategories, searchItems } from '../controllers/catalog.controller';

const router = Router();

router.get('/categories', listCategories);
router.get('/search', searchItems);

export default router;
