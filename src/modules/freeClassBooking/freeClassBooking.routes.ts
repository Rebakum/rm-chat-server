import { Router } from "express";
import * as ctrl from "./freeClassBooking.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { bookFreeClassSchema, updateFreeClassStatusSchema } from "./freeClassBooking.validation";

const router = Router();

router.post(
  "/free-class-bookings",
  requireAuth,
  validateRequest(bookFreeClassSchema),
  ctrl.bookFreeClass
);

router.get("/free-class-bookings", requireAdmin, ctrl.getAllFreeClassBookings);

router.patch(
  "/free-class-bookings/:id/status",
  requireAdmin,
  validateRequest(updateFreeClassStatusSchema),
  ctrl.updateFreeClassStatus
);

export default router;
