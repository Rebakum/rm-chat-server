export interface MemberSelect {
  id: string;
  name: string | null;
  displayName: string | null;
  photoURL: string | null;
  status?: string;
  online: boolean;
}

export interface ChatWithMembers {
  id: string;
  member1Id: string;
  member2Id: string;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  member1: MemberSelect;
  member2: MemberSelect;
}

export interface ChatWithLastMessage extends ChatWithMembers {
  messages: {
    id: string;
    chatId: string;
    senderId: string;
    receiverId: string;
    text: string;
    type: string;
    timestamp: Date;
  }[];
}

export interface CreateChatDTO {
  member1Id: string;
  member2Id: string;
}
