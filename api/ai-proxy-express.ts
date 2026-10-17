import { Router } from 'express';
import { handleAIRequest } from './_ai-handler';

const router = Router();
router.post('/ai-proxy', handleAIRequest);
export default router;
