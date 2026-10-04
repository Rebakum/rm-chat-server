import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import prisma from "../lib/prisma";
import env from "../config/env";
import { getAuthenticatedSession } from "../middlewares/auth";
import { handlePresence } from "./presence";
import { handleChat } from "./chat";
import { handleCall } from "./call";
import logger from "../lib/logger";

const userSocketMap = new Map<string, string>();

// HTTP controllers (e.g. call.controller.ts) need to emit socket events
// after a REST action succeeds — keep a module-level io reference for that.
let ioInstance: Server | null = null;

export const getReceiverSocketId = (userId: string): string | undefined =>
  userSocketMap.get(userId);

export const emitToUser = (userId: string, event: string, payload: unknown): void => {
  const socketId = userSocketMap.get(userId);
  if (ioInstance && socketId) {
    ioInstance.to(socketId).emit(event, payload);
  }
};

// Room broadcast (chat rooms double as monitor rooms, so moderation events
// like message_deleted have to reach every joined socket — participants and
// admins alike).
export const emitToRoom = (roomId: string, event: string, payload: unknown): void => {
  if (ioInstance) {
    ioInstance.to(roomId).emit(event, payload);
  }
};

export const emitToAll = (event: string, payload: unknown): void => {
  ioInstance?.emit(event, payload);
};

export const emitToAdmins = (event: string, payload: unknown): void => {
  ioInstance?.to("admins").emit(event, payload);
};

export const disconnectUserSockets = (userId: string): void => {
  ioInstance?.in(`user:${userId}`).disconnectSockets(true);
  userSocketMap.delete(userId);
};

export const initSocket = (httpServer: HttpServer): Server => {
  const isDevelopment = env.NODE_ENV === "development";
  const allowedOrigins = Array.from(
    new Set([
      ...(process.env.CLIENT_URL || "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean),
      ...(isDevelopment ? ["http://localhost:3000"] : []),
    ])
  ).filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance = io;

  io.use(async (socket, next) => {
    try {
      const authenticated = await getAuthenticatedSession(socket.handshake.headers);
      if (!authenticated) {
        return next(new Error("Authentication required"));
      }
      (socket as any).userId = authenticated.session.user.id;
      (socket as any).userRole = authenticated.account.role;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = (socket as any).userId as string;
    if (!userId) {
      socket.disconnect();
      return;
    }

    userSocketMap.set(userId, socket.id);
    socket.join(`user:${userId}`);
    if ((socket as any).userRole === "admin") {
      socket.join("admins");
    }

    // Register every event listener SYNCHRONOUSLY before the first await:
    // the client can emit join_room/send_message the instant its "connect"
    // fires, and anything sent before a listener exists is silently dropped.
    handlePresence(io, socket, userSocketMap);
    handleChat(io, socket, userSocketMap);
    handleCall(io, socket, userSocketMap);

    socket.on("disconnect", async () => {
      if (userId) {
        if (userSocketMap.get(userId) === socket.id) userSocketMap.delete(userId);
        const offlineAt = new Date();
        await prisma.user.update({
          where: { id: userId },
          data: { online: false, offlineAt },
        });
        io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
        io.emit("user_status", {
          userId,
          online: false,
          lastSeen: offlineAt.toISOString(),
        });
      }
    });

    const onlineAt = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { online: true, onlineAt },
    });
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    io.emit("user_status", {
      userId,
      online: true,
      lastSeen: onlineAt.toISOString(),
    });
  });

  return io;
};
