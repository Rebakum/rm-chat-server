import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

const createCustomOrderSchema = z.object({
  body: z.object({
    subject: z.string().min(1),
    totalHours: z.number().positive(),
    hourlyRate: z.number().positive(),
    totalPrice: z.number().positive(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    teacherId: userIdSchema,
  }),
});

const updateStatusSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({ status: z.enum(["Pending", "Accepted", "In Progress", "Completed", "Cancelled"]) }),
});

export { createCustomOrderSchema, updateStatusSchema };
