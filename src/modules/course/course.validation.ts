import { z } from "zod";

const createCourseSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.email(),
    phone: z.string().optional(),
    gender: z.string().optional(),
    terms: z.boolean().optional(),
    courseName: z.string().min(1),
  }),
});

export { createCourseSchema };
