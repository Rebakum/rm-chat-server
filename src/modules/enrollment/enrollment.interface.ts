export interface EnrollDTO {
  courseId: string;
  courseName?: string;
  name?: string;
  country?: string;
  address?: string;
  whatsapp?: string;
  paymentMethod?: string;
  paymentSender?: string;
  transactionId?: string;
}

export type EnrollmentStatus = "pending" | "approved" | "rejected";
