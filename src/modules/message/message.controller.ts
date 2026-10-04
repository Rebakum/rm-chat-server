import { Request, Response } from "express";
import * as messageService from "./message.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";
import { emitToRoom } from "../../sockets";

const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await messageService.create(req.body, req.user!.id);
  ApiResponse.created(res, message);
});

const getMessages = asyncHandler(async (req: Request, res: Response) => {
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
    req.user!.id,
    before,
  );
  ApiResponse.paginated(res, result.messages, result.total, page, limit, "Success", {
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  });
});

const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  await messageService.markRead(req.params.chatId as string, req.user!.id);
  ApiResponse.success(res, null, "Messages marked as read");
});

const updateMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await messageService.updateText(
    req.params.id as string,
    req.user!.id,
    req.body,
  );
  emitToRoom(message.chatId, "message_edited", message);
  ApiResponse.success(res, message, "Message updated");
});

export { sendMessage, getMessages, markAsRead, updateMessage };
