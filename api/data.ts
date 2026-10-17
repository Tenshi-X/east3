import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleDataRequest } from './_data-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.url ?? '').split('?')[0].replace(/^\/api\/data\/?/, '');
  const [table, id] = path.split('/').filter(Boolean);
  return handleDataRequest(req, res, table, id);
}
