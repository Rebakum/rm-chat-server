import { z } from "zod";
import { userIdSchema } from "../../utils/validators";

const appointmentIdParams = z.object({
  appointmentId: z.uuid(),
});

const appointmentStatusEnum = z.enum(["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"]);

const createAppointmentSchema = z.object({
  body: z.object({
    teacherId: userIdSchema,
    // ISO 8601, offset or Z allowed (e.g. "2026-09-25T10:00:00.000Z")
    startTime: z.iso.datetime({ offset: true }).optional(),
  }),
});

const getAppointmentSchema = z.object({
  params: appointmentIdParams,
});

const updateAppointmentStatusSchema = z.object({
  params: appointmentIdParams,
  // PENDING is the creation default, so clients may only move forward.
  body: z.object({
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
  }),
});

const listAppointmentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: appointmentStatusEnum.optional(),
  }),
});

export {
  createAppointmentSchema,
  getAppointmentSchema,
  updateAppointmentStatusSchema,
  listAppointmentsSchema,
};

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type GetAppointmentInput = z.infer<typeof getAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type ListAppointmentsInput = z.infer<typeof listAppointmentsSchema>;
