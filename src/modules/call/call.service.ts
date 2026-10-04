import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { Call, CallSession, CallType, Prisma } from "@prisma/client";
import ApiError from "../../utils/ApiError";
import { v4 as uuidv4 } from "uuid";

const initiate = async (
  chatId: string,
  userId: string,
  calleeId: string,
  type: CallType,
): Promise<Call & { sessions: CallSession[] }> => {
  if (userId === calleeId) {
    throw ApiError.badRequest("You cannot call yourself");
  }

  const callee = await prisma.user.findUnique({ where: { id: calleeId }, select: { id: true } });
  if (!callee) {
    throw ApiError.notFound("User not found");
  }

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    throw ApiError.notFound("Chat not found");
  }
  if (
    (chat.member1Id !== userId && chat.member2Id !== userId) ||
    (chat.member1Id !== calleeId && chat.member2Id !== calleeId)
  ) {
    throw ApiError.forbidden("This chat does not belong to both participants");
  }
  const activeCall = await prisma.call.findFirst({
    where: {
      OR: [
        { userId, peerId: calleeId },
        { userId: calleeId, peerId: userId },
      ],
      sessions: { some: { endedAt: null } },
    },
    select: { id: true },
  });
  if (activeCall) {
    throw ApiError.conflict("An active call already exists between these users");
  }

  const startedAt = new Date();
  return prisma.call.create({
    data: {
      roomName: `call-${uuidv4()}`,
      chatId,
      type,
      userId,
      peerId: calleeId,
      lastCallAt: startedAt,
      sessions: {
        create: { startedAt },
      },
    },
    include: { sessions: true },
  });
};


const findActive = async (
  userId: string,
  peerId: string,
): Promise<(Call & { sessions: CallSession[] }) | null> => {
  return prisma.call.findFirst({
    where: {
      OR: [
        { userId, peerId },
        { userId: peerId, peerId: userId },
      ],
      sessions: { some: { endedAt: null } },
    },
    include: { sessions: true },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Closes the currently open CallSession (if any) and stamps lastCallAt.
 * Shared by the REST end path and the socket room path — returns null when
 * there is nothing to close (already ended / never started), so callers can
 * decide between "throw 404" and "silent no-op".
 */
const closeActiveSession = async (
  call: Call & { sessions: CallSession[] },
  duration?: number,
): Promise<{ session: CallSession; call: Call } | null> => {
  const activeSession = call.sessions.find((session) => session.endedAt === null);
  if (!activeSession) return null;

  const endedAt = new Date();
  const computedDuration =
    duration ??
    Math.max(0, Math.floor((endedAt.getTime() - activeSession.startedAt.getTime()) / 1000));

  const [session] = await prisma.$transaction([
    prisma.callSession.update({
      where: { id: activeSession.id },
      data: { endedAt, duration: computedDuration },
    }),
    prisma.call.update({
      where: { id: call.id },
      data: { lastCallAt: endedAt },
    }),
  ]);
  return { session, call };
};

/**
 * Records that `userId` actually joined the call room during the
 * currently-open session — called from sockets/call.ts on join-call-room.
 * Lets the admin tell a real two-party class apart from one side dialing in
 * alone (see CallSession.participantIds).
 */
const recordParticipant = async (callId: string, userId: string): Promise<void> => {
  const session = await prisma.callSession.findFirst({
    where: { callId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session || session.participantIds.includes(userId)) return;
  await prisma.callSession.update({
    where: { id: session.id },
    data: { participantIds: { push: userId } },
  });
};

const end = async (
  callId: string,
  userId: string,
  duration?: number,
): Promise<{ session: CallSession; call: Call }> => {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { sessions: { orderBy: { startedAt: "desc" } } },
  });
  if (!call) {
    throw ApiError.notFound("Call not found");
  }

  if (call.userId !== userId && call.peerId !== userId) {
    throw ApiError.forbidden("You are not a participant of this call");
  }

  const closed = await closeActiveSession(call, duration);
  if (!closed) {
    throw ApiError.notFound("No active call session found for this call");
  }
  return closed;
};

/**
 * Ends the session if it is still open — used by the socket when the last
 * participant leaves the call room (call page no longer hits PATCH /end).
 * Returns the call (with sessions) when it closed something, else null.
 */
const endIfActive = async (callId: string): Promise<(Call & { sessions: CallSession[] }) | null> => {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { sessions: { orderBy: { startedAt: "desc" } } },
  });
  if (!call) return null;
  const closed = await closeActiveSession(call);
  return closed ? call : null;
};

const getById = async (callId: string, userId: string, userRole?: string) => {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      user: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
      peer: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
    },
  });
  if (!call) throw ApiError.notFound("Call not found");
  // Admins may join any room to observe — everyone else must be a participant.
  if (call.userId !== userId && call.peerId !== userId && userRole !== "admin") {
    throw ApiError.forbidden("You are not a participant of this call");
  }
  return call;
};

const getLiveCalls = async () => {
  return prisma.call.findMany({
    where: { sessions: { some: { endedAt: null } } },
    include: {
      user: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
      peer: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
      sessions: { where: { endedAt: null }, orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { lastCallAt: "desc" },
  });
};

const getCallHistory = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
  type?: CallType,
) => {
  const { skip, take } = paginate({ page, limit }, page, limit);
  const where: Prisma.CallWhereInput = {
    AND: [
      { OR: [{ userId }, { peerId: userId }] },
      ...(type ? [{ type }] : []),
    ],
  };
  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, displayName: true, photoURL: true } },
        peer: { select: { id: true, name: true, displayName: true, photoURL: true } },
        sessions: true,
      },
      orderBy: [{ lastCallAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.call.count({ where }),
  ]);
  return { calls, total };
};
// Admin: every call+session, live or historical, across all users —
// distinct from getCallHistory (scoped to one participant) and getLiveCalls
// (live-only, unpaginated).
const getAllCallsAdmin = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      include: {
        user: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
        peer: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
        sessions: { orderBy: { startedAt: "desc" } },
      },
      orderBy: [{ lastCallAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.call.count(),
  ]);
  return { calls, total };
};

// Admin: session detail for any call, unlike getById which 403s non-participants.
const getByIdAdmin = async (callId: string) => {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      user: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
      peer: { select: { id: true, name: true, displayName: true, photoURL: true, role: true } },
      sessions: { orderBy: { startedAt: "desc" } },
    },
  });
  if (!call) throw ApiError.notFound("Call not found");
  return call;
};

const getChatCallHistory = async (chatId: string, page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const where: Prisma.CallWhereInput = { chatId };

  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, displayName: true, photoURL: true } },
        peer: { select: { id: true, name: true, displayName: true, photoURL: true } },
        sessions: true,
      },
      orderBy: [{ lastCallAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.call.count({ where }),
  ]);
  return { calls, total };
};

export { initiate, findActive, end, endIfActive, recordParticipant, getById, getByIdAdmin, getLiveCalls, getAllCallsAdmin, getCallHistory, getChatCallHistory };

