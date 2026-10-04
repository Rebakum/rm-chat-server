import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

const initiateCallSchema = z.object({
  body: z.object({
    chatId: z.uuid(),
    calleeId: userIdSchema,
    type: z.enum(["video", "audio"]),
  }),
});

const endCallSchema = z.object({
  params: z.object({
    callId: z.uuid(),
  }),
  body: z.object({
    duration: z.number().int().nonnegative().optional(),
  }),
});

const getCallHistorySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    type: z.enum(["video", "audio"]).optional(),
  }),
});

const getActiveCallSchema = z.object({
  query: z.object({
    peerId: userIdSchema,
  }),
});

const getCallByIdSchema = z.object({
  params: z.object({
    callId: z.uuid(),
  }),
});

export { initiateCallSchema, endCallSchema, getCallHistorySchema, getActiveCallSchema, getCallByIdSchema };

export type InitiateCallInput = z.infer<typeof initiateCallSchema>;
export type EndCallInput = z.infer<typeof endCallSchema>;
export type GetCallHistoryInput = z.infer<typeof getCallHistorySchema>;
export type GetActiveCallInput = z.infer<typeof getActiveCallSchema>;
export type GetCallByIdInput = z.infer<typeof getCallByIdSchema>;
