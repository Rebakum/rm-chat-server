export interface CreatePaymentMethodDTO {
  type: string;
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  accountHolder?: string;
  routingNumber?: string;
}

export interface UpdatePaymentMethodDTO {
  type?: string;
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  accountHolder?: string;
  routingNumber?: string;
}
