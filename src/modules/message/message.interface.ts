import { Prisma } from "@prisma/client";

export interface SendMessageDTO {
  chatId: string;
  receiverId: string;
  text?: string;
  type?: "text" | "file" | "order";
  fileUrl?: string;
  fileName?: string;
  replyToId?: string;
}

export interface MessageWithSender {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  type: string;
  orderId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  replyToId: string | null;
  read: boolean;
  isEdited: boolean;
  timestamp: Date;
  reactions: Array<{ userId: string; emoji: string }>;
  sender: {
    id: string;
    name: string | null;
    displayName: string | null;
    photoURL: string | null;
    image?: string | null;
    role?: string;
  };
  replyTo?: MessageWithSender | null;
}

export interface PaginatedMessages {
  messages: MessageWithSender[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface UpdateMessageDTO {
  text: string;
}
