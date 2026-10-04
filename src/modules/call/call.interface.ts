export type CallKind = "video" | "audio";

export interface InitiateCallDTO {
  chatId: string;
  calleeId: string;
  type: CallKind;
}

export interface CallResponseDTO {
  id: string;
  roomName: string;
  chatId: string;
  type: CallKind;
  userId: string;
  peerId: string;
  lastCallAt: Date | null;
  createdAt: Date;
}

export interface CallSessionResponseDTO {
  id: string;
  callId: string;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null;
}

export interface CallHistoryItem {
  id: string;
  roomName: string;
  chatId: string;
  type: CallKind;
  userId: string;
  peerId: string;
  lastCallAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    displayName: string | null;
    photoURL: string | null;
  };
  peer: {
    id: string;
    name: string;
    displayName: string | null;
    photoURL: string | null;
  };
  sessions: CallSessionResponseDTO[];
}
