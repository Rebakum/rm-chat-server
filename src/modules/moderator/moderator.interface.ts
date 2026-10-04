export interface InviteModeratorDTO {
  userId: string;
}

export interface InvitationResponse {
  invitationId: string;
  token: string;
  expiresAt: Date;
}

export interface moderatorInvitationWithUser {
  id: string;
  userId: string;
  invitedByAdminId: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  invitedUser: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}
