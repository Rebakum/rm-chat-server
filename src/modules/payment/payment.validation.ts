import { z } from "zod";

const submitPaymentSchema = z.object({
  body: z.object({
    serviceTitle: z.string().optional(),
    bookingPrice: z.number().optional(),
    paymentMethod: z.string().optional(),
    accountNumber: z.string().optional(),
    transactionId: z.string().optional(),
    bankName: z.string().optional(),
    accountHolder: z.string().optional(),
    paymentProofUrl: z.string().optional(),
  }),
  params: z.object({ bookingId: z.uuid() }),
});

export { submitPaymentSchema };
