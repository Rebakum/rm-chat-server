import { Server, Socket } from "socket.io";
import prisma from "../lib/prisma";
import * as messageService from "../modules/message/message.service";

interface AuthenticatedChatSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface SendPayload {
  chatId?: string;
  receiverId?: string;
  text?: string;
  type?: string;
  fileUrl?: string;
  fileName?: string;
  replyToId?: string;
}

interface Ack {
  (response: {
    ok: boolean;
    error?: string;
    message?: unknown;
  }): void;
}

type JoinPayload = string | { chatId?: string };

// The DB only knows text/file/order; the UI talks in
// TEXT/IMAGE/VIDEO/AUDIO/FILE. Collapse the media variants onto "file" —
// the concrete mime type lives in fileName/fileUrl on the client side.
const normalizeType = (type?: string): "text" | "file" | "order" => {
  const lower = (type || "text").toLowerCase();
  if (lower === "order") return "order";
  if (lower === "text") return "text";
  return "file";
};

const chatIdFrom = (payload: JoinPayload | undefined): string => {
  if (typeof payload === "string") return payload;
  return String(payload?.chatId ?? "");
};

export const handleChat = (
  io: Server,
  socket: AuthenticatedChatSocket,
  userSocketMap: Map<string, string>
): void => {
  const senderId = socket.userId;
  const isModerator =
    socket.userRole === "admin" || socket.userRole === "moderator";

  const canJoin = async (chatId: string): Promise<boolean> => {
    if (!senderId || !chatId) return false;
    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) return false;
    const isMember =
      chat.member1Id === senderId || chat.member2Id === senderId;
    return isMember || isModerator;
  };

  const joinRoom = async (payload: JoinPayload, ack?: Ack): Promise<void> => {
    const chatId = chatIdFrom(payload);
    if (!(await canJoin(chatId))) {
      ack?.({ ok: false, error: "Not authorized to join this room." });
      return;
    }
    socket.join(chatId);
    ack?.({ ok: true });
  };

  const leaveRoom = (payload: JoinPayload): void => {
    const chatId = chatIdFrom(payload);
    if (chatId) socket.leave(chatId);
  };

  // Persist-on-send: the acknowledgement carries the stored message (with
  // sender profile + reply preview attached) so the caller can render its own
  // bubble immediately without refetching the thread.
  const sendMessageEvent = async (
    data: SendPayload,
    ack?: Ack
  ): Promise<void> => {
    try {
      if (!senderId) throw new Error("Not authenticated");

      let chatId = data.chatId ? String(data.chatId) : "";
      let receiverId = data.receiverId ? String(data.receiverId) : "";

      if (chatId) {
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || (chat.member1Id !== senderId && chat.member2Id !== senderId)) {
          throw new Error("Not a member of this chat");
        }
        const expectedReceiverId =
          chat.member1Id === senderId ? chat.member2Id : chat.member1Id;
        if (receiverId && receiverId !== expectedReceiverId) {
          throw new Error("Receiver is not a member of this chat");
        }
        receiverId = expectedReceiverId;
      } else if (receiverId) {
        const existing = await prisma.chat.findFirst({
          where: {
            OR: [
              { member1Id: senderId, member2Id: receiverId },
              { member1Id: receiverId, member2Id: senderId },
            ],
          },
        });
        const chat = existing ?? (await prisma.chat.create({
          data: { member1Id: senderId, member2Id: receiverId },
        }));
        chatId = chat.id;
      } else {
        throw new Error("chatId or receiverId is required");
      }

      const message = await messageService.create(
        {
          chatId,
          receiverId,
          text: data.text,
          type: normalizeType(data.type),
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          replyToId: data.replyToId,
        },
        senderId
      );

      // Room emit covers everyone who opened the thread (participants) plus
      // any admin monitoring it; the direct emit covers a participant who has
      // the app open elsewhere. Clients de-duplicate by message id, so the
      // overlap is harmless.
      io.to(chatId).emit("receive_message", message);
      io.to(chatId).emit("receive-message", message);

      const receiverSocketId = userSocketMap.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive_message", message);
        io.to(receiverSocketId).emit("receive-message", message);
        io.to(receiverSocketId).emit("new_message", {
          chatId,
          senderId,
          receiverId,
          message,
        });
        io.to(receiverSocketId).emit("notification:new", {
          chatId,
          senderId,
          message: message.text || "New message",
        });
      }

      ack?.({ ok: true, message });
    } catch (error) {
      ack?.({
        ok: false,
        error:
          error instanceof Error ? error.message : "Message was not sent.",
      });
    }
  };

  const editMessageEvent = async (
    data: { messageId?: string; text?: string },
    ack?: Ack,
  ): Promise<void> => {
    try {
      if (!senderId) throw new Error("Not authenticated");
      if (!data?.messageId || typeof data.text !== "string") {
        throw new Error("Message ID and text are required");
      }
      const message = await messageService.updateText(data.messageId, senderId, {
        text: data.text,
      });
      io.to(message.chatId).emit("message_edited", message);
      ack?.({ ok: true, message });
    } catch (error) {
      ack?.({
        ok: false,
        error: error instanceof Error ? error.message : "Message was not edited.",
      });
    }
  };

  const reactToMessageEvent = async (
    data: { messageId?: string; emoji?: string },
    ack?: Ack,
  ): Promise<void> => {
    try {
      if (!senderId) throw new Error("Not authenticated");
      if (!data?.messageId || typeof data.emoji !== "string") {
        throw new Error("Message ID and reaction emoji are required");
      }
      const message = await messageService.toggleReaction(
        data.messageId,
        senderId,
        data.emoji,
      );
      io.to(message.chatId).emit("message_reacted", message);
      ack?.({ ok: true, message });
    } catch (error) {
      ack?.({
        ok: false,
        error: error instanceof Error ? error.message : "Reaction was not saved.",
      });
    }
  };

  const typingEvent = (data: {
    receiverId?: string;
    isTyping?: boolean;
  }): void => {
    if (!senderId || !data?.receiverId) return;
    const isTyping = data.isTyping !== false;
    const receiverSocketId = userSocketMap.get(data.receiverId);
    if (!receiverSocketId) return;
    io.to(receiverSocketId).emit("typing", {
      senderId,
      isTyping,
    });
    io.to(receiverSocketId).emit(
      isTyping ? "user-typing" : "user-stop-typing",
      { senderId, receiverId: data.receiverId }
    );
  };

  // Participant room lifecycle (WhatsApp-style thread view).
  socket.on("join_room", (payload: JoinPayload, ack?: Ack) => {
    void joinRoom(payload, ack);
  });
  socket.on("join-chat", (payload: JoinPayload, ack?: Ack) => {
    void joinRoom(payload, ack);
  });
  socket.on("leave_room", leaveRoom);
  socket.on("leave-chat", leaveRoom);

  // Sending — new snake_case name first, legacy kebab-case kept for old clients.
  socket.on("send_message", (data: SendPayload, ack?: Ack) => {
    void sendMessageEvent(data, ack);
  });
  socket.on("send-message", (data: SendPayload, ack?: Ack) => {
    void sendMessageEvent(data, ack);
  });
  socket.on("edit_message", (data: { messageId?: string; text?: string }, ack?: Ack) => {
    void editMessageEvent(data, ack);
  });
  socket.on("react_message", (data: { messageId?: string; emoji?: string }, ack?: Ack) => {
    void reactToMessageEvent(data, ack);
  });

  socket.on("typing", typingEvent);
  socket.on("stop_typing", (data: { receiverId?: string }) =>
    typingEvent({ ...data, isTyping: false })
  );
  socket.on("stop-typing", (data: { receiverId?: string }) =>
    typingEvent({ ...data, isTyping: false })
  );

  // Admin/moderation live monitoring: same join rules as above, only the
  // moderator path allows non-members (regular members use join_room).
  socket.on("monitor_room", (payload: JoinPayload, ack?: Ack) => {
    void joinRoom(payload, ack);
  });
  socket.on("unmonitor_room", leaveRoom);
};
