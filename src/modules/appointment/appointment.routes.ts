import { Router } from "express";
import * as ctrl from "./appointment.controller";
import { requireAuth, requireStudent } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import {
  createAppointmentSchema,
  getAppointmentSchema,
  updateAppointmentStatusSchema,
  listAppointmentsSchema,
} from "./appointment.validation";

const router = Router();

router.post(
  "/appointments",
  requireStudent,
  validateRequest(createAppointmentSchema),
  ctrl.scheduleAppointment,
);
router.get(
  "/appointments",
  requireAuth,
  validateRequest(listAppointmentsSchema),
  ctrl.listAppointments,
);
router.get(
  "/appointments/:appointmentId",
  requireAuth,
  validateRequest(getAppointmentSchema),
  ctrl.getAppointment,
);
router.patch(
  "/appointments/:appointmentId/status",
  requireAuth,
  validateRequest(updateAppointmentStatusSchema),
  ctrl.updateAppointmentStatus,
);

export default router;
