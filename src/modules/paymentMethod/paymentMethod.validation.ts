import { z } from "zod";

export const createPaymentMethodSchema = z.object({
  body: z.object({
    type: z.string().min(1, "Payment method type is required"),
    accountNumber: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    branchName: z.string().optional().nullable(),
    accountHolder: z.string().optional().nullable(),
    routingNumber: z.string().optional().nullable(),
  }),
});

export const updatePaymentMethodSchema = z.object({
  body: z.object({
    type: z.string().optional(),
    accountNumber: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    branchName: z.string().optional().nullable(),
    accountHolder: z.string().optional().nullable(),
    routingNumber: z.string().optional().nullable(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid payment method ID"),
  }),
});
