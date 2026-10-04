import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import ApiError from "../../utils/ApiError";
import { NotificationResponse } from "./notification.interface";
import { emitToUser } from "../../sockets";

const createNotification = async (
  userId: string,
  type: string,
  message: string,
  actionData?: Record<string, unknown>
): Promise<void> => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        actionData: (actionData as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
  }
};

/**
 * Persist a notification AND push it to the recipient's live socket in one
 * step. `createNotification` on its own is poll-only (nothing in the client
 * calls GET /notifications), while the dashboard already listens for
 * `notification:new` — so pairing them is what makes a notification visible
 * without a reload.
 *
 * `chatId` is optional on purpose: class start/end events are not chat
 * messages, so callers can omit it and let the toast fire everywhere.
 */
const notifyUser = async (
  userId: string,
  type: string,
  message: string,
  actionData?: Record<string, unknown>,
  chatId?: string,
): Promise<void> => {
  await createNotification(userId, type, message, actionData);
  emitToUser(userId, "notification:new", {
    message,
    type,
    chatId: chatId ?? (typeof actionData?.chatId === "string" ? actionData.chatId : null),
    actionData: actionData ?? null,
  });
};

// Fans a notification out to every admin — used for events that need admin
// attention (new teacher application, payment awaiting verification) where
// there's no single natural recipient.
const notifyAdmins = async (
  type: string,
  message: string,
  actionData?: Record<string, unknown>,
): Promise<void> => {
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  await Promise.all(admins.map((admin) => notifyUser(admin.id, type, message, actionData)));
};

const getMyNotifications = async (
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ items: NotificationResponse[]; total: number; unreadCount: number }> => {
  const skip = (Math.max(1, page) - 1) * limit;
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return {
    items: notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      message: n.message,
      actionData: n.actionData as Record<string, unknown> | null,
      read: n.read,
      createdAt: n.createdAt,
    })),
    total,
    unreadCount,
  };
};

const getUnreadCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({ where: { userId, read: false } });
};

const markAsRead = async (
  notificationId: string,
  userId: string
): Promise<void> => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) throw ApiError.notFound("Notification not found");
  if (notification.userId !== userId) throw ApiError.forbidden("Not your notification");

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
};

const markAllAsRead = async (userId: string): Promise<number> => {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
};

const deleteNotification = async (
  notificationId: string,
  userId: string
): Promise<void> => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) throw ApiError.notFound("Notification not found");
  if (notification.userId !== userId) throw ApiError.forbidden("Not your notification");

  await prisma.notification.delete({ where: { id: notificationId } });
};

// ---- Admin send ---------------------------------------------------------
// Admin-facing push: persists the row and fans it out over the socket in the
// same call (notifyUser), so delivery does not wait for a poll.
const sendToUser = async (
  userId: string,
  type: string,
  message: string,
  actionData?: Record<string, unknown>
): Promise<void> => {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) throw ApiError.notFound("Recipient user not found");
  await notifyUser(userId, type, message, actionData);
};

const sendToAll = async (
  type: string,
  message: string,
  actionData?: Record<string, unknown>
): Promise<number> => {
  const users = await prisma.user.findMany({
    where: { status: { not: "banned" } },
    select: { id: true },
  });
  const results = await Promise.allSettled(
    users.map((user) => notifyUser(user.id, type, message, actionData))
  );
  return results.filter((result) => result.status === "fulfilled").length;
};

export {
  createNotification,
  notifyUser,
  notifyAdmins,
  sendToUser,
  sendToAll,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
