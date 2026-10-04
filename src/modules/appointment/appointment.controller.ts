import { Request, Response } from "express";
import * as appointmentService from "./appointment.service";
import type { UpdatableAppointmentStatus } from "./appointment.service";
import type { AppointmentStatusKind } from "./appointment.interface";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

interface ListQuery {
  page?: number;
  limit?: number;
  status?: AppointmentStatusKind;
}

// POST /api/appointments — student schedules a 1:1 session with a teacher.
// Returns the record incl. the server-generated (unguessable) roomName.
const scheduleAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { teacherId, startTime } = req.body as { teacherId: string; startTime?: string };
  const appointment = await appointmentService.schedule(req.user!.id, { teacherId, startTime });
  ApiResponse.created(res, appointment, "Session scheduled");
});

// GET /api/appointments — current user's sessions (student or teacher side).
const listAppointments = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.validated?.query ?? {}) as ListQuery;
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const { appointments, total } = await appointmentService.list(
    req.user!.id,
    page,
    limit,
    query.status,
  );
  ApiResponse.paginated(res, appointments, total, page, limit);
});

// GET /api/appointments/:appointmentId — participants only (403 otherwise).
const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  const appointmentId = String(req.params.appointmentId);
  const appointment = await appointmentService.getById(appointmentId, req.user!.id);
  ApiResponse.success(res, appointment);
});

// PATCH /api/appointments/:appointmentId/status — SCHEDULED / COMPLETED / CANCELLED.
const updateAppointmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const appointmentId = String(req.params.appointmentId);
  const { status } = req.body as { status: UpdatableAppointmentStatus };
  const appointment = await appointmentService.updateStatus(appointmentId, req.user!.id, status);
  ApiResponse.success(res, appointment, "Session updated");
});

export { scheduleAppointment, listAppointments, getAppointment, updateAppointmentStatus };
