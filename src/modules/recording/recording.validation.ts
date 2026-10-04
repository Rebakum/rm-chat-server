import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

const uploadRecordingSchema = z.object({
  body: z
    .object({
      bookingId: z.uuid().optional(),
      callId: z.uuid().optional(),
      appointmentId: z.uuid().optional(),
      teacherId: userIdSchema,
      studentId: userIdSchema,
      videoUrl: z.url().optional(),
      roomName: z.string().optional(),
      teacherName: z.string().optional(),
      studentName: z.string().optional(),
    })
    .refine((data) => Boolean(data.bookingId || data.callId || data.appointmentId), {
      message: "bookingId, callId or appointmentId is required",
      path: ["bookingId"],
    }),
});

export { uploadRecordingSchema };
