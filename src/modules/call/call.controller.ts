import { Request, Response } from "express";
import * as callService from "./call.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import { emitToUser } from "../../sockets";
import { notifyUser, notifyAdmins } from "../notification/notification.service";

interface CallHistoryQuery {
  page?: number;
  limit?: number;
  type?: "video" | "audio";
}

interface ActiveCallQuery {
  peerId: string;
}

const initiateCall = asyncHandler(async (req: Request, res: Response) => {
  const { chatId, calleeId, type } = req.body;
  const call = await callService.initiate(chatId, req.user!.id, calleeId, type);

  emitToUser(calleeId, "incoming-call", {
    callId: call.id,
    roomName: call.roomName,
    chatId: call.chatId,
    callerId: req.user!.id,
    callerName: req.user!.name ?? "Rahmah user",
    calleeId: call.peerId,
    type: call.type,
  });

  ApiResponse.created(res, call);
});

const endCall = asyncHandler(async (req: Request, res: Response) => {
  const { callId } = req.params;
  const { duration } = req.body;
  const { session, call } = await callService.end(callId as string, req.user!.id, duration);

  const otherParticipantId = call.userId === req.user!.id ? call.peerId : call.userId;
  emitToUser(otherParticipantId, "call-ended", {
    callId: call.id,
    roomName: call.roomName,
    endedBy: req.user!.id,
  });
  await notifyUser(otherParticipantId, "class_ended", "Class has ended.", {
    callId: call.id,
    roomName: call.roomName,
    endedBy: req.user!.id,
  });
  await notifyAdmins("class_ended", "A live class has ended.", { callId: call.id, roomName: call.roomName });

  ApiResponse.success(res, session);
});

const getCallById = asyncHandler(async (req: Request, res: Response) => {
  const call = await callService.getById(String(req.params.callId), req.user!.id, (req.user as any).role);
  ApiResponse.success(res, call);
});

const getLiveCalls = asyncHandler(async (_req: Request, res: Response) => {
  const calls = await callService.getLiveCalls();
  ApiResponse.success(res, calls);
});

const getAllCallsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(String(req.query.page ?? 1)) || 1);
  const limit = Math.min(100, Math.max(1, Number(String(req.query.limit ?? 20)) || 20));
  const { calls, total } = await callService.getAllCallsAdmin(page, limit);
  ApiResponse.paginated(res, calls, total, page, limit);
});

const getCallDetailAdmin = asyncHandler(async (req: Request, res: Response) => {
  const call = await callService.getByIdAdmin(String(req.params.callId));
  ApiResponse.success(res, call);
});

const getCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.validated?.query ?? {}) as CallHistoryQuery;
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const { calls, total } = await callService.getCallHistory(req.user!.id, page, limit, query.type);
  ApiResponse.paginated(res, calls, total, page, limit);
});

const getActiveCall = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.validated?.query ?? {}) as ActiveCallQuery;
  const call = await callService.findActive(req.user!.id, query.peerId);
  ApiResponse.success(res, call);
});

const getChatCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const chatId = String(req.params.chatId);
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { calls, total } = await callService.getChatCallHistory(chatId, page, limit);
  ApiResponse.paginated(res, calls, total, page, limit);
});

export { initiateCall, endCall, getActiveCall, getCallById, getLiveCalls, getAllCallsAdmin, getCallDetailAdmin, getCallHistory, getChatCallHistory };
