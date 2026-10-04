import { Router } from "express";
import * as ctrl from "./notification.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { markAsReadSchema, sendNotificationSchema } from "./notification.validation";

const router = Router();

router.get("/notifications", requireAuth, ctrl.getMyNotifications);
router.get("/notifications/unread-count", requireAuth, ctrl.getUnreadCount);
router.patch("/notifications/read-all", requireAuth, ctrl.markAllAsRead);
router.patch("/notifications/:id/read", requireAuth, validateRequest(markAsReadSchema), ctrl.markAsRead);
router.delete("/notifications/:id", requireAuth, validateRequest(markAsReadSchema), ctrl.deleteNotification);

// Admin push — broadcast (all=true) or a single named recipient.
router.post(
  "/admin/notifications",
  requireAdmin,
  validateRequest(sendNotificationSchema),
  ctrl.sendNotification
);

export default router;
