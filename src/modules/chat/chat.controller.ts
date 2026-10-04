import { Request, Response } from "express";
import * as chatService from "./chat.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";
import * as messageService from "../message/message.service";
import { emitToRoom, emitToUser } from "../../sockets";
import prisma from "../../lib/prisma";

const isAdmin = (req: Request) => (req.user as { role?: string })?.role === "admin";

const createOrGetChat = asyncHandler(async (req: Request, res: Response) => {
  const chat = await chatService.createOrGet(req.user!.id, req.body.member2Id);
  ApiResponse.success(res, chat);
});

// People directory behind the chat sidebar — everyone except yourself.
const getDirectory = asyncHandler(async (req: Request, res: Response) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const users = await chatService.getDirectory(
    req.user!.id,
    search || undefined
  );
  ApiResponse.success(res, users);
});

// POST /chats/direct/:userId — find-or-create the 1:1 chat with a person.
const openDirect = asyncHandler(async (req: Request, res: Response) => {
  const chat = await chatService.createOrGet(req.user!.id, req.params.userId as string);
  ApiResponse.success(res, chat);
});

const getUserChats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  if (req.user!.id !== userId && !isAdmin(req)) {
    throw ApiError.forbidden("Not authorized to view these chats");
  }
  const chats = await chatService.getUserChats(userId);
  ApiResponse.success(res, chats);
});

// Thread history: members read their own threads (membership enforced by the
// service), admins/moderators may open any room — that's what powers the
// global chat monitor.
const getChatMessages = asyncHandler(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const requestedPage = Number(String(req.query.page ?? 1));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLimit = Number(String(req.query.limit ?? 50));
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 50;
  const before =
    typeof (req.query.before ?? req.query.cursor) === "string" &&
    String(req.query.before ?? req.query.cursor).length > 0
      ? String(req.query.before ?? req.query.cursor)
      : undefined;
  const result = await messageService.getByChat(
    chatId,
    page,
    limit,
    isAdmin(req) ? undefined : req.user!.id,
    before
  );
  if (isAdmin(req)) {
    // Admins skip membership checks, so confirm the room actually exists
    // (members get the same 404 from verifyChatMembership).
    await chatService.getAdminChatById(chatId);
  }
  ApiResponse.paginated(res, result.messages, result.total, page, limit, "Success", {
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  });
});

// Attachment proxy: the UI points <img>/<a> at this endpoint instead of
// leaking storage URLs, and membership is enforced before the redirect.
const getMessageFile = asyncHandler(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const messageId = req.params.messageId as string;
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.chatId !== chatId) {
    throw ApiError.notFound("Message not found");
  }
  if (!isAdmin(req)) {
    await messageService.getByChat(chatId, 1, 1, req.user!.id);
  }
  if (!message.fileUrl) throw ApiError.notFound("No file on this message");
  res.redirect(message.fileUrl);
});

const getMonitorRooms = asyncHandler(async (req: Request, res: Response) => {
  const rooms = await chatService.getMonitorRooms();
  ApiResponse.success(res, rooms);
});

const deleteMessageAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await messageService.removeMessage(req.params.messageId as string);
  const payload = {
    messageId: result.messageId,
    chatId: result.chatId,
    deletedAt: new Date().toISOString(),
    deletedById: req.user!.id,
    reason: typeof req.body?.reason === "string" ? req.body.reason : null,
  };
  emitToRoom(result.chatId, "message_deleted", payload);
  const chat = await chatService.getAdminChatById(result.chatId).catch(() => null);
  if (chat) {
    emitToUser(chat.member1Id, "message_deleted", payload);
    emitToUser(chat.member2Id, "message_deleted", payload);
  }
  ApiResponse.success(res, result, "Message deleted");
});

const deleteChatAdmin = asyncHandler(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const chat = await chatService.getAdminChatById(chatId);
  const result = await chatService.removeChat(chatId);
  const payload = { chatId, deletedAt: new Date().toISOString(), deletedById: req.user!.id };
  emitToUser(chat.member1Id, "chat_deleted", payload);
  emitToUser(chat.member2Id, "chat_deleted", payload);
  ApiResponse.success(res, result, "Chat deleted");
});

const getAdminChats = asyncHandler(async (req: Request, res: Response) => {
  const chats = await chatService.getAdminChats();
  ApiResponse.success(res, chats);
});

const getAdminChatById = asyncHandler(async (req: Request, res: Response) => {
  const chat = await chatService.getAdminChatById(req.params.chatId as string);
  ApiResponse.success(res, chat);
});

const getAdminChatMessages = asyncHandler(async (req: Request, res: Response) => {
  const requestedPage = Number(String(req.query.page ?? 1));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLimit = Number(String(req.query.limit ?? 50));
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 50;
  const before =
    typeof (req.query.before ?? req.query.cursor) === "string" &&
    String(req.query.before ?? req.query.cursor).length > 0
      ? String(req.query.before ?? req.query.cursor)
      : undefined;
  const result = await messageService.getByChat(
    req.params.chatId as string,
    page,
    limit,
    undefined,
    before,
  );
  ApiResponse.paginated(res, result.messages, result.total, page, limit, "Success", {
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  });
});

export {
  createOrGetChat,
  getDirectory,
  openDirect,
  getUserChats,
  getChatMessages,
  getMessageFile,
  getMonitorRooms,
  deleteMessageAdmin,
  deleteChatAdmin,
  getAdminChats,
  getAdminChatById,
  getAdminChatMessages,
};
