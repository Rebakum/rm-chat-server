export interface CreateNotificationDTO {
  userId: string;
  type: string;
  message: string;
  actionData?: Record<string, unknown>;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  message: string;
  actionData: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date;
}
