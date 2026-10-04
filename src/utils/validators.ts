import { z } from "zod";

export const userIdSchema = z.string().min(8).max(64).regex(/^[\w-]+$/);
