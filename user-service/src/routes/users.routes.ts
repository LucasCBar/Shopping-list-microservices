import { Router, type RequestHandler } from 'express';
import { getMe, updateMe } from '../controllers/users.controller';
import { authMiddleware } from '../../../shared/jwt';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const requireAuth: RequestHandler = authMiddleware(JWT_SECRET) as unknown as RequestHandler;

router.get('', requireAuth, getMe);
router.put('', requireAuth, updateMe);

export default router;
