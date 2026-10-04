import { z } from "zod";

export const bookFreeClassSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.email(),
    courseName: z.string().optional(),
    sourcePage: z.string().optional(),
    sourceUrl: z.string().optional(),
    sourceTitle: z.string().optional(),
    referrer: z.string().optional(),
  }),
});

export const updateFreeClassStatusSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    status: z.enum(["Pending", "Contacted", "Scheduled", "Completed", "Cancelled"]),
    adminNote: z.string().optional(),
  }),
});

export type BookFreeClassInput = z.infer<typeof bookFreeClassSchema>;
