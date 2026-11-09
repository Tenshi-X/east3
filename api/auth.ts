import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleAuthRequest } from "./_auth-handler";
export default function handler(req: VercelRequest,res: VercelResponse) {
  return handleAuthRequest(req,res,(req.url || "").replace(/^\/api\/auth\/?/,"").split("?")[0]);
}
