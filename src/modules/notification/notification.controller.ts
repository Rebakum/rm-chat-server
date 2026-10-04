import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import * as notificationService from "./notification.service";

const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(String(req.query.page ?? 1)) || 1);
  const limit = Math.min(50, Math.max(1, Number(String(req.query.limit ?? 20)) || 20));
  const { items, total, unreadCount } = await notificationService.getMyNotifications(req.user!.id, page, limit);
  ApiResponse.paginated(res, items, total, page, limit, "Success", { unreadCount });
});

const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await notificationService.getUnreadCount(req.user!.id);
  ApiResponse.success(res, { count });
});

const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAsRead(req.params.id as string, req.user!.id);
  ApiResponse.success(res, null, "Marked as read");
});

const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const count = await notificationService.markAllAsRead(req.user!.id);
  ApiResponse.success(res, { count }, "All notifications marked as read");
});

const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.deleteNotification(req.params.id as string, req.user!.id);
  ApiResponse.success(res, null, "Notification deleted");
});

// Admin compose: one recipient via userId, or a platform-wide fan-out via
// all=true. actionData is passed through untouched for client-side routing.
const sendNotification = asyncHandler(async (req: Request, res: Response) => {
  const { userId, all, type, message, actionData } = req.body as {
    userId?: string;
    all?: boolean;
    type?: string;
    message: string;
    actionData?: Record<string, unknown>;
  };
  const notificationType = type || "admin";

  if (all) {
    const sent = await notificationService.sendToAll(
      notificationType,
      message,
      actionData
    );
    ApiResponse.success(res, { sent }, "Notification sent to all users");
    return;
  }

  await notificationService.sendToUser(
    userId as string,
    notificationType,
    message,
    actionData
  );
  ApiResponse.success(res, { sent: 1 }, "Notification sent");
});

export {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotification,
};
