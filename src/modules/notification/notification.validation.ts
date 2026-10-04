import { z } from "zod";

const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

// Admin broadcast/compose: target one user by id or everyone at once.
// `actionData` rides along so the client can deep-link (chatId, userId, URL…).
const sendNotificationSchema = z.object({
  body: z
    .object({
      userId: z.string().min(1).optional(),
      all: z.boolean().optional(),
      type: z.string().min(1).max(60).optional(),
      message: z.string().min(1).max(500),
      actionData: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((body) => body.all || body.userId, {
      message: "Either userId or all=true is required",
    }),
});

export { markAsReadSchema, sendNotificationSchema };
