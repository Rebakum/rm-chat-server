import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { ChatWithLastMessage, MemberSelect } from "./chat.interface";
import ApiError from "../../utils/ApiError";

const memberSelect = {
  select: {
    id: true,
    name: true,
    displayName: true,
    photoURL: true,
    status: true,
    online: true,
  } as const,
};

const createOrGet = async (
  member1Id: string,
  member2Id: string
): Promise<ChatWithLastMessage> => {
  if (member1Id === member2Id) {
    throw ApiError.badRequest("Users cannot start a chat with themselves");
  }

  const existing = await prisma.chat.findFirst({
    where: {
      OR: [
        { member1Id, member2Id },
        { member1Id: member2Id, member2Id: member1Id },
      ],
    },
    include: {
      member1: memberSelect,
      member2: memberSelect,
    },
  });

  if (existing) {
    return existing as ChatWithLastMessage;
  }

  const target = await prisma.user.findUnique({
    where: { id: member2Id },
    select: { status: true },
  });
  if (!target) throw ApiError.notFound("User not found");
  if (target.status === "rejected" || target.status === "banned") {
    throw ApiError.forbidden("This user is unavailable for new conversations");
  }

  const chat = await prisma.chat.create({
    data: { member1Id, member2Id },
    include: {
      member1: memberSelect,
      member2: memberSelect,
    },
  });


  return chat as ChatWithLastMessage;
};

const getUserChats = async (userId: string): Promise<ChatWithLastMessage[]> => {
  const chats = await prisma.chat.findMany({
    where: {
      OR: [{ member1Id: userId }, { member2Id: userId }],
    },
    include: {
      member1: memberSelect,
      member2: memberSelect,
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (chats.length === 0) return [];

  const unreadCounts = await prisma.message.groupBy({
    by: ["chatId"],
    where: {
      chatId: { in: chats.map((chat) => chat.id) },
      receiverId: userId,
      read: false,
    },
    _count: { _all: true },
  });
  const unreadByChatId = new Map(
    unreadCounts.map((count) => [count.chatId, count._count._all]),
  );

  return chats.map((chat) => ({
    ...chat,
    unreadCount: unreadByChatId.get(chat.id) ?? 0,
  })) as ChatWithLastMessage[];
};

const DIRECTORY_SELECT = {
  id: true,
  name: true,
  displayName: true,
  photoURL: true,
  image: true,
  role: true,
  status: true,
  online: true,
  lastSeen: true,
  offlineAt: true,
} as const;

const getDirectory = async (viewerId: string, search?: string) => {
  const where: Prisma.UserWhereInput = {
    id: { not: viewerId },
    status: { not: "banned" },
  };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }
  return prisma.user.findMany({
    where,
    select: DIRECTORY_SELECT,
    orderBy: [{ online: "desc" }, { displayName: "asc" }],
    take: 200,
  });
};

const getMonitorRooms = async (): Promise<ChatWithLastMessage[]> => {
  const chats = await prisma.chat.findMany({
    include: {
      member1: memberSelect,
      member2: memberSelect,
      messages: {
        orderBy: { timestamp: "desc" },
        take: 5,
        include: {
          sender: {
            select: {
              name: true,
              displayName: true,
              role: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return chats as ChatWithLastMessage[];
};

const removeChat = async (chatId: string): Promise<{ chatId: string }> => {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) throw ApiError.notFound("Chat not found");
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { chatId } }),
    prisma.chat.delete({ where: { id: chatId } }),
  ]);
  return { chatId };
};

const getAdminChats = async (): Promise<ChatWithLastMessage[]> => {
  const chats = await prisma.chat.findMany({
    include: {
      member1: memberSelect,
      member2: memberSelect,
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return chats as ChatWithLastMessage[];
};

const getAdminChatById = async (chatId: string): Promise<ChatWithLastMessage> => {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      member1: memberSelect,
      member2: memberSelect,
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  if (!chat) throw ApiError.notFound("Conversation not found");
  return chat as ChatWithLastMessage;
};

export {
  createOrGet,
  getUserChats,
  getDirectory,
  getMonitorRooms,
  removeChat,
  getAdminChats,
  getAdminChatById,
};
