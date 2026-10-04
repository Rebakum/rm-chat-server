import { z } from "zod";
import { userIdSchema } from "../../utils/validators";
import { USER_STATUSES } from "../../constants/teacher-options";

const updateTeacherStatusSchema = z.object({
  body: z.object({ status: z.enum(USER_STATUSES) }),
  params: z.object({ teacherId: userIdSchema }),
});

const updateTeacherPaymentStatusSchema = z.object({
  body: z.object({ paymentStatus: z.enum(["current", "overdue", "waived"]) }),
  params: z.object({ teacherId: userIdSchema }),
});

export { updateTeacherStatusSchema, updateTeacherPaymentStatusSchema };
