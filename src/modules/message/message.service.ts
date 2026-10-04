import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { SendMessageDTO, MessageWithSender, PaginatedMessages, UpdateMessageDTO } from "./message.interface";
import ApiError from "../../utils/ApiError";
import { createNotification } from "../notification/notification.service";

const verifyChatMembership = async (chatId: string, userId: string) => {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      member1: { select: { status: true } },
      member2: { select: { status: true } },
    },
  });
  if (!chat) throw ApiError.notFound("Chat not found");
  if (chat.member1Id !== userId && chat.member2Id !== userId) {
    throw ApiError.forbidden("Not authorized to access this chat");
  }
  const member = chat.member1Id === userId ? chat.member1 : chat.member2;
  if (member.status === "rejected" || member.status === "banned") {
    throw ApiError.forbidden("This account has been rejected or disabled");
  }
  return chat;
};

const create = async (data: SendMessageDTO, senderId: string): Promise<MessageWithSender> => {
  const chat = await verifyChatMembership(data.chatId, senderId);
  const expectedReceiverId = chat.member1Id === senderId ? chat.member2Id : chat.member1Id;
  if (data.receiverId !== expectedReceiverId) {
    throw ApiError.forbidden("Receiver is not a member of this chat");
  }
  const message = await prisma.$transaction(async (tx) => {
    const members = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status
      FROM "User"
      WHERE id = ${senderId} OR id = ${data.receiverId}
      ORDER BY id
      FOR UPDATE
    `;
    const sender = members.find((member) => member.id === senderId);
    const receiver = members.find((member) => member.id === data.receiverId);
    if (!sender || sender.status === "rejected" || sender.status === "banned") {
      throw ApiError.forbidden("This account has been rejected or disabled");
    }
    if (!receiver || receiver.status === "rejected" || receiver.status === "banned") {
      throw ApiError.forbidden("This user is unavailable and cannot receive messages");
    }

    const created = await tx.message.create({
      data: {
        chatId: data.chatId,
        senderId,
        receiverId: data.receiverId,
        text: data.text || "",
        type: data.type || "text",
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        replyToId: data.replyToId,
      },
      include: {
        sender: { select: { id: true, name: true, displayName: true, photoURL: true, image: true, role: true } },
        replyTo: true,
        reactions: { select: { userId: true, emoji: true } },
      },
    });
    // Bump the parent chat's updatedAt so chat lists (getUserChats/getAdminChats,
    // both ordered by updatedAt desc) reflect the most recently active
    // conversation, not just the most recently created one.
    await tx.chat.update({ where: { id: data.chatId }, data: { updatedAt: new Date() } });
    return created;
  }) as MessageWithSender;

  await createNotification(
    data.receiverId,
    "message",
    `New message from ${message.sender.displayName ?? message.sender.name ?? "a user"}`,
    { chatId: data.chatId, senderId },
  );

  return message;
};

const getByChat = async (
  chatId: string,
  page = 1,
  limit = 50,
  userId?: string,
  before?: string,
): Promise<PaginatedMessages> => {
  if (userId) await verifyChatMembership(chatId, userId);

  // Fetch newest-first so the first page is the latest window. Older pages use
  // the oldest visible message as a stable cursor; reverse before returning so
  // every consumer receives chronological order (oldest at the top).
  const cursor = before ? await prisma.message.findUnique({ where: { id: before } }) : null;
  if (before && (!cursor || cursor.chatId !== chatId)) {
    throw ApiError.badRequest("Invalid message cursor");
  }
  const scoped = cursor;

  const where: Prisma.MessageWhereInput = scoped
    ? {
        chatId,
        OR: [
          { timestamp: { lt: scoped.timestamp } },
          { timestamp: scoped.timestamp, id: { lt: scoped.id } },
        ],
      }
    : { chatId };

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, displayName: true, photoURL: true, image: true, role: true } },
        replyTo: true,
        reactions: { select: { userId: true, emoji: true } },
      },
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit + 1,
    }),
    prisma.message.count({ where: { chatId } }),
  ]);
  const hasMore = messages.length > limit;
  const chronological = messages.slice(0, limit).reverse() as MessageWithSender[];
  return {
    messages: chronological,
    total,
    hasMore,
    nextCursor: hasMore ? chronological[0]?.id ?? null : null,
  };
};

const markRead = async (chatId: string, receiverId: string): Promise<void> => {
  await verifyChatMembership(chatId, receiverId);
  await prisma.message.updateMany({
    where: { chatId, receiverId, read: false },
    data: { read: true },
  });
};

const updateText = async (
  messageId: string,
  senderId: string,
  data: UpdateMessageDTO,
): Promise<MessageWithSender> => {
  return prisma.$transaction(async (tx) => {
    const [message] = await tx.$queryRaw<
      Array<{ id: string; senderId: string; type: string; text: string }>
    >`SELECT id, "senderId", type, text FROM "Message" WHERE id = ${messageId} FOR UPDATE`;
    if (!message) throw ApiError.notFound("Message not found");
    if (message.senderId !== senderId) {
      throw ApiError.forbidden("You can only edit your own messages");
    }
    if (message.type.toLowerCase() !== "text") {
      throw ApiError.badRequest("Only text messages can be edited");
    }

    const updatedText = data.text.trim();
    if (!updatedText) throw ApiError.badRequest("Message text cannot be empty");
    if (updatedText.length > 10000) {
      throw ApiError.badRequest("Message text cannot exceed 10000 characters");
    }
    if (message.text === updatedText) {
      throw ApiError.badRequest("Message text has not changed");
    }

    await tx.messageEditHistory.create({
      data: {
        messageId,
        previousText: message.text,
        editedById: senderId,
      },
    });

    return tx.message.update({
      where: { id: messageId },
      data: { text: updatedText, isEdited: true },
      include: {
        sender: { select: { id: true, name: true, displayName: true, photoURL: true, image: true, role: true } },
        replyTo: true,
        reactions: { select: { userId: true, emoji: true } },
      },
    }) as Promise<MessageWithSender>;
  });
};

const getEditHistory = async (messageId: string) => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true },
  });
  if (!message) throw ApiError.notFound("Message not found");

  return prisma.messageEditHistory.findMany({
    where: { messageId },
    orderBy: { editedAt: "asc" },
    select: {
      id: true,
      previousText: true,
      editedById: true,
      editedAt: true,
    },
  });
};

const toggleReaction = async (
  messageId: string,
  userId: string,
  emoji: string,
): Promise<MessageWithSender> => {
  if (emoji.length > 16) throw ApiError.badRequest("Invalid reaction emoji");
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, chatId: true },
  });
  if (!message) throw ApiError.notFound("Message not found");
  await verifyChatMembership(message.chatId, userId);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
    });
    if (existing) {
      await tx.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await tx.messageReaction.create({ data: { messageId, userId, emoji } });
    }
  });

  return prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: { id: true, name: true, displayName: true, photoURL: true, image: true, role: true } },
      replyTo: true,
      reactions: { select: { userId: true, emoji: true } },
    },
  }) as Promise<MessageWithSender>;
};

// Admin/moderation delete: removes the row outright so it disappears from
// both participants' histories and from the monitor feed alike.
const removeMessage = async (
  messageId: string
): Promise<{ messageId: string; chatId: string }> => {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound("Message not found");
  await prisma.message.delete({ where: { id: messageId } });
  return { messageId: message.id, chatId: message.chatId };
};

export { create, getByChat, markRead, updateText, getEditHistory, toggleReaction, removeMessage };
