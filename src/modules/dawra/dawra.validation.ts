import { z } from "zod";

export const createDawraSchema = z.object({
  body: z.object({
    email: z.email(),
    displayName: z.string().optional(),
    birthCertificateUrl: z.url(),
    fatherName: z.string().optional(),
    fatherPhone: z.string().optional(),
    currentStudy: z.string().optional(),
    phone: z.string().optional(),
  }),
});

export const addMonthlyFeeSchema = z.object({
  body: z.object({
    month: z.string().optional(),
    amount: z.number().optional(),
    paid: z.boolean().optional(),
    transactionId: z.string().optional(),
    paymentMethod: z.string().optional(),
    paymentPhone: z.string().optional(),
  }),
  params: z.object({ id: z.uuid() }),
});

export type CreateDawraInput = z.infer<typeof createDawraSchema>;
export type AddMonthlyFeeInput = z.infer<typeof addMonthlyFeeSchema>;
