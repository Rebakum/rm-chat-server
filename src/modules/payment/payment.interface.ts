export interface SubmitPaymentDTO {
  serviceTitle?: string;
  bookingPrice?: number;
  paymentMethod?: string;
  accountNumber?: string;
  transactionId?: string;
  bankName?: string;
  accountHolder?: string;
  paymentProofUrl?: string;
}
