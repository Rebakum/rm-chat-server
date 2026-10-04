import { z } from "zod";

const submitReviewSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    email: z.email(),
    role: z.string().optional(),
    photoURL: z.string().optional(),
    presentCountry: z.string().optional(),
    rating: z.number().min(1).max(5),
    description: z.string().min(1),
  }),
});

export { submitReviewSchema };
