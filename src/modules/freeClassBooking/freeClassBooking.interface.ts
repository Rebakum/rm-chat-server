import { FreeClassBooking, User } from "@prisma/client";

export type BookFreeClassDTO = {
  name: string;
  email: string;
  courseName?: string;
  sourcePage?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  referrer?: string;
};

export type FreeClassBookingWithUser = FreeClassBooking & {
  user: Pick<User, "id" | "name" | "email"> | null;
};
