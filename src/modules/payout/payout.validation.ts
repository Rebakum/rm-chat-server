import { z } from "zod";

const requestPayoutSchema = z.object({
  body: z.object({
    amountRequested: z.number().positive(),
    method: z.string().min(1),
  }),
});

const markPaidSchema = z.object({
  body: z.object({
    amountPaid: z.number().positive(),
  }),
  params: z.object({ id: z.uuid() }),
});

export { requestPayoutSchema, markPaidSchema };
