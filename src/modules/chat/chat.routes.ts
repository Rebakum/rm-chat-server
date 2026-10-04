import { Router } from "express";
import * as ctrl from "./chat.controller";
import { requireAuth, requireAdmin, requireRole } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createChatSchema } from "./chat.validation";

const router = Router();

router.post(
  "/chats",
  requireAuth,
  validateRequest(createChatSchema),
  ctrl.createOrGetChat
);

// Static/suffixed paths must be registered before /chats/:userId-style
// handlers so they never get swallowed by a param match.
router.get("/chats/directory", requireAuth, ctrl.getDirectory);
router.post("/chats/direct/:userId", requireAuth, ctrl.openDirect);
router.get(
  "/chats/monitor/rooms",
  requireRole("admin", "moderator"),
  ctrl.getMonitorRooms
);
router.delete("/chats/messages/:messageId", requireAdmin, ctrl.deleteMessageAdmin);
router.get(
  "/chats/messages/:messageId/edit-history",
  requireRole("admin", "moderator"),
  ctrl.getMessageEditHistory
);

router.get("/chats/:chatId/messages", requireAuth, ctrl.getChatMessages);
router.get(
  "/chats/:chatId/messages/:messageId/file",
  requireAuth,
  ctrl.getMessageFile
);
router.delete("/chats/:chatId", requireAdmin, ctrl.deleteChatAdmin);

router.get("/chats/:userId", requireAuth, ctrl.getUserChats);
router.get("/admin/chats", requireAdmin, ctrl.getAdminChats);
router.get("/admin/chats/:chatId", requireAdmin, ctrl.getAdminChatById);
router.get("/admin/chats/:chatId/messages", requireAdmin, ctrl.getAdminChatMessages);

export default router;
