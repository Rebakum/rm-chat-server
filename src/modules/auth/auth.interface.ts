export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  image?: string | null;
  lastSeen?: Date | null;
  createdAt?: Date;
  role: string;
  status: string;
  emailVerified: boolean | null;
}

export interface SessionSummary {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}
