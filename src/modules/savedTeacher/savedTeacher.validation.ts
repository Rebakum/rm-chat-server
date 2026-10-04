import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

export const saveTeacherSchema = z.object({
  body: z.object({ teacherId: userIdSchema }),
});

export const unsaveTeacherSchema = z.object({
  params: z.object({ teacherId: userIdSchema }),
});

export type SaveTeacherInput = z.infer<typeof saveTeacherSchema>;
export type UnsaveTeacherInput = z.infer<typeof unsaveTeacherSchema>;
