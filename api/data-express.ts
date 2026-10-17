import { Router } from 'express';
import { handleDataRequest } from './_data-handler';

const router = Router();
router.all('/:table', (req, res) => handleDataRequest(req, res, req.params.table));
router.all('/:table/:id', (req, res) => handleDataRequest(req, res, req.params.table, req.params.id));
export default router;
