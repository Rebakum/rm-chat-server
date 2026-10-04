import { Payout, User } from "@prisma/client";

export interface RequestPayoutDTO {
  amountRequested: number;
  method: string;
}

export interface PayoutWithTeacher extends Payout {
  teacher: Pick<User, "id" | "name" | "email" | "photoURL">;
}

export interface MarkPaidDTO {
  amountPaid: number;
}
