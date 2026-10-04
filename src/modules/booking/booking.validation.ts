import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

const createBookingSchema = z.object({
  body: z.object({
    bookingType: z.enum(["Service", "Custom"]),
    serviceId: z
      .string()
      .uuid()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    customOrderId: z
      .string()
      .uuid()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined)),
    teacherId: userIdSchema,
    bookingPrice: z.number().positive(),
  }),
});

const studentConfirmSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5).optional(),
    comment: z.string().optional(),
  }),
  params: z.object({ id: z.uuid() }),
});

export { createBookingSchema, studentConfirmSchema };
