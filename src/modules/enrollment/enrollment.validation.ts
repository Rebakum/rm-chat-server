import { z } from "zod";

const enrollSchema = z.object({
  body: z.object({
    courseId: z.uuid(),
    courseName: z.string().optional(),
    name: z.string().optional(),
    country: z.string().optional(),
    address: z.string().optional(),
    whatsapp: z.string().optional(),
    paymentMethod: z.string().optional(),
    paymentSender: z.string().optional(),
    transactionId: z.string().optional(),
  }),
});

const updateStatusSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    status: z.enum(["pending", "approved", "rejected", "completed"]),
  }),
});

export { enrollSchema, updateStatusSchema };
