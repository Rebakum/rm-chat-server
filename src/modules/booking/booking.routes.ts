import { Router } from "express";
import * as ctrl from "./booking.controller";
import { requireAuth, requireAdmin, requireTeacher, requireStudent } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createBookingSchema, studentConfirmSchema } from "./booking.validation";

const router = Router();

router.get("/bookings/mine", requireAuth, ctrl.getMyBookings);
router.get("/bookings/:id", requireAuth, ctrl.getBookingById);
router.get("/booking-progress/:id", requireAuth, ctrl.getBookingProgress);
router.post("/bookings", requireAuth, requireStudent, validateRequest(createBookingSchema), ctrl.createBooking);
router.patch("/bookings/:id/student-confirm", requireAuth, requireStudent, validateRequest(studentConfirmSchema), ctrl.studentConfirmBooking);
router.patch("/bookings/:id/teacher-confirm", requireAuth, requireTeacher, ctrl.teacherConfirmBooking);

router.get("/bookings", requireAdmin, ctrl.getAllBookings);
router.patch("/admin/bookings/:id/complete", requireAdmin, ctrl.adminCompleteBooking);
router.patch("/bookings/:id/accept", requireAuth, requireTeacher, ctrl.acceptBooking);
router.patch("/bookings/:id/start", requireAuth, requireTeacher, ctrl.startBooking);

export default router;
