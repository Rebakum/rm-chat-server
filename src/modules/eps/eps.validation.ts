import { z } from "zod";

const initiateEpsSchema = z.object({
  body: z.object({
    bookingId: z.uuid(),
    amountUSD: z.number().positive(),
    amountBDT: z.number().positive(),
    exchangeRate: z.number().positive(),
  }),
});

export { initiateEpsSchema };
