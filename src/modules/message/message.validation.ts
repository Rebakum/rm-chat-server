import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

const sendMessageSchema = z.object({
  body: z.object({
    chatId: z.uuid(),
    receiverId: userIdSchema,
    text: z.string().optional(),
    type: z.enum(["text", "file", "order"]).optional(),
    fileUrl: z.string().optional(),
    fileName: z.string().optional(),
    replyToId: z.uuid().optional(),
  }),
});

const updateMessageSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    text: z.string().trim().min(1).max(10000),
  }),
});

type SendMessageInput = z.infer<typeof sendMessageSchema>;

export { sendMessageSchema, updateMessageSchema, SendMessageInput };
