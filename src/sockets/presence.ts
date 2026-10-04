import { Server, Socket } from "socket.io";
import prisma from "../lib/prisma";

export const handlePresence = (io: Server, socket: Socket, userSocketMap: Map<string, string>): void => {
  socket.on("register-user", async () => {
    const userId = (socket as any).userId as string;
    if (!userId) return;
    userSocketMap.set(userId, socket.id);
    await prisma.user.update({
      where: { id: userId },
      data: { online: true, onlineAt: new Date() },
    });
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  });
};
