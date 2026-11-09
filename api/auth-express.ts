import { Router } from "express";
import { handleAuthRequest } from "./_auth-handler";
const router = Router();
router.all("/:action", (req,res) => handleAuthRequest(req,res,String(req.params.action)));
export default router;
