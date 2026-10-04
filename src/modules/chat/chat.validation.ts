import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

const createChatSchema = z.object({
  body: z.object({ member2Id: userIdSchema }),
});

type CreateChatInput = z.infer<typeof createChatSchema>;

export { createChatSchema, CreateChatInput };
