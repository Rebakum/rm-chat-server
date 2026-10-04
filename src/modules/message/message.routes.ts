import { Router } from "express";
import * as ctrl from "./message.controller";
import { requireAuth } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { sendMessageSchema, updateMessageSchema } from "./message.validation";

const router = Router();

router.post("/messages", requireAuth, validateRequest(sendMessageSchema), ctrl.sendMessage);
router.patch("/messages/:id", requireAuth, validateRequest(updateMessageSchema), ctrl.updateMessage);
router.get("/messages/:chatId", requireAuth, ctrl.getMessages);
router.patch("/messages/:chatId/read", requireAuth, ctrl.markAsRead);

export default router;
