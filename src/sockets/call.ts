import { Server, Socket } from "socket.io";
import * as callService from "../modules/call/call.service";
import { notifyUser, notifyAdmins } from "../modules/notification/notification.service";

interface CallData {
  receiverId?: string;
  callId?: string;
  [key: string]: unknown;
}

// callId -> socket ids currently sitting in that call room.
const callRooms = new Map<string, Set<string>>();
// socketId -> call ids that socket joined (needed for disconnect cleanup).
const socketCalls = new Map<string, Set<string>>();
// callId -> pending "close it for good" timer (see CLOSE_GRACE_MS).
const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();
// callId -> user ids that already got a "class_started" notification for this
// call. StrictMode (and socket reconnects) re-run the client's join effect, so
// without this the teacher-joined notification fires 2-3x per join.
const joinNotified = new Map<string, Set<string>>();

/**
 * How long a room may stay empty before the session is really closed.
 *
 * The client emits leave-then-join within milliseconds in three normal
 * situations: React StrictMode's effect setup/cleanup/setup (dev), a page
 * refresh, and a socket reconnect. Closing on the very first empty check made
 * `initiateCall`'s session end ~4s after it opened, which pushed `call-ended`
 * back to the client and bounced everyone to /dashboard/chat.
 */
const CLOSE_GRACE_MS = 5000;

const cancelPendingClose = (callId: string): void => {
  const timer = closeTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    closeTimers.delete(callId);
  }
};

/**
 * The client sends either the raw callId string or a { callId } object —
 * accept both so a payload-shape change cannot silently break the room.
 */
const readCallId = (payload: unknown): string => {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const callId = (payload as { callId?: unknown }).callId;
    if (typeof callId === "string") return callId;
  }
  return "";
};

const joinRoom = (socketId: string, callId: string): void => {
  let members = callRooms.get(callId);
  if (!members) {
    members = new Set<string>();
    callRooms.set(callId, members);
  }
  members.add(socketId);

  let joined = socketCalls.get(socketId);
  if (!joined) {
    joined = new Set<string>();
    socketCalls.set(socketId, joined);
  }
  joined.add(callId);

  // Anyone (re)joining cancels a scheduled close — the call is live again.
  cancelPendingClose(callId);
};

const leaveRoom = (socketId: string, callId: string): void => {
  const members = callRooms.get(callId);
  if (members) {
    members.delete(socketId);
    if (members.size === 0) callRooms.delete(callId);
  }
  const joined = socketCalls.get(socketId);
  if (joined) {
    joined.delete(callId);
    if (joined.size === 0) socketCalls.delete(socketId);
  }
};

/**
 * Last one out closes the class: ends the open CallSession in the DB and
 * tells BOTH participants. Without this, sessions would stay endedAt=null
 * forever and every future initiate would 409 ("active call already exists").
 *
 * Deferred by CLOSE_GRACE_MS so a transient empty room (StrictMode remount,
 * refresh, reconnect) does not tear down a call that is about to be rejoined.
 * This is a *schedule* — it never ends anything synchronously.
 */
const endIfEmpty = (
  io: Server,
  userSocketMap: Map<string, string>,
  callId: string,
): void => {
  if (closeTimers.has(callId)) return;

  const timer = setTimeout(() => {
    closeTimers.delete(callId);
    // Someone rejoined during the grace window — call is still live.
    if (callRooms.has(callId)) return;

    void (async () => {
      try {
        const call = await callService.endIfActive(callId);
        if (!call) return;
        for (const userId of [call.userId, call.peerId]) {
          const socketId = userSocketMap.get(userId);
          if (socketId) {
            io.to(socketId).emit("call-ended", {
              callId: call.id,
              roomName: call.roomName,
              endedBy: null,
            });
          }
          await notifyUser(userId, "class_ended", "Class has ended.", {
            callId: call.id,
            roomName: call.roomName,
          });
        }
        await notifyAdmins("class_ended", "A live class has ended.", { callId: call.id, roomName: call.roomName });
        // Class is over — drop the join de-dup state for it.
        joinNotified.delete(call.id);
      } catch {
        // session already closed elsewhere (REST decline/end) — nothing to do
      }
    })();
  }, CLOSE_GRACE_MS);

  closeTimers.set(callId, timer);
};

/** The two participants may always sit in a call room; an admin may join any room to observe. */
const getCallIfParticipant = async (callId: string, userId: string, userRole?: string) => {
  try {
    return await callService.getById(callId, userId, userRole);
  } catch {
    return null;
  }
};

/**
 * Tell the student when their teacher walks into the class, and tell every
 * admin so they can observe live from the notification bell.
 *
 * Role comes from the socket handshake (`sockets/index.ts` sets it from the
 * Better Auth session); if that ever comes back undefined we fall back to the
 * role stored on the Call row we just loaded.
 *
 * De-duplicated per (callId, userId) because the client emits join-call-room
 * twice under React StrictMode (mount → cleanup → mount) and again on every
 * socket reconnect.
 */
const notifyTeacherJoined = async (
  call: NonNullable<Awaited<ReturnType<typeof getCallIfParticipant>>>,
  joinerId: string,
  socket: Socket,
): Promise<void> => {
  const isActualParticipant = call.userId === joinerId || call.peerId === joinerId;
  if (!isActualParticipant) return; // an admin observer joining — nothing to announce

  const joiner = call.userId === joinerId ? call.user : call.peer;
  const handshakeRole = (socket as unknown as { userRole?: string }).userRole;
  if ((handshakeRole ?? joiner?.role) !== "teacher") return;

  const alreadyNotified = joinNotified.get(call.id);
  if (alreadyNotified?.has(joinerId)) return;
  if (!alreadyNotified) joinNotified.set(call.id, new Set([joinerId]));
  else alreadyNotified.add(joinerId);

  const student = call.userId === joinerId ? call.peer : call.user;
  const studentName = student?.displayName || student?.name || "a student";
  const teacherName = joiner?.displayName || joiner?.name || "A teacher";

  if (student && student.id !== joinerId) {
    await notifyUser(student.id, "class_started", "Your teacher has joined the class.", {
      callId: call.id,
      roomName: call.roomName,
    });
  }

  await notifyAdmins(
    "class_started",
    `${teacherName} started a live class with ${studentName}.`,
    { callId: call.id, roomName: call.roomName },
  );
};

export const handleCall = (io: Server, socket: Socket, userSocketMap: Map<string, string>): void => {
  const socketId = socket.id;
  const userId = (socket as unknown as { userId?: string }).userId;
  const userRole = (socket as unknown as { userRole?: string }).userRole;

  socket.on("join-call-room", (payload: unknown) => {
    const callId = readCallId(payload);
    if (!callId || !userId) return;
    void (async () => {
      const call = await getCallIfParticipant(callId, userId, userRole);
      if (!call) return;
      joinRoom(socketId, callId);
      const isActualParticipant = call.userId === userId || call.peerId === userId;
      if (isActualParticipant) await callService.recordParticipant(callId, userId);
      await notifyTeacherJoined(call, userId, socket);
    })();
  });

  socket.on("leave-call-room", (payload: unknown) => {
    const callId = readCallId(payload);
    if (!callId || !userId) return;
    void (async () => {
      const call = await getCallIfParticipant(callId, userId, userRole);
      if (!call) return;
      leaveRoom(socketId, callId);
      // Only an actual participant leaving should start the grace-period
      // close — an admin observer leaving shouldn't tear down someone
      // else's live class.
      const isActualParticipant = call.userId === userId || call.peerId === userId;
      if (isActualParticipant) endIfEmpty(io, userSocketMap, callId);
    })();
  });

  socket.on("disconnect", () => {
    const joined = socketCalls.get(socketId);
    const callIds = joined ? Array.from(joined) : [];
    for (const callId of callIds) leaveRoom(socketId, callId);
    socketCalls.delete(socketId);
    for (const callId of callIds) endIfEmpty(io, userSocketMap, callId);
  });

  socket.on("call-rejected", (data: CallData) => {
    const receiverSocketId = data.receiverId ? userSocketMap.get(data.receiverId) : undefined;
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-rejected", data);
    }
  });

  socket.on("call-ended", (data: CallData) => {
    const receiverSocketId = data.receiverId ? userSocketMap.get(data.receiverId) : undefined;
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-ended", data);
    }
  });
};
