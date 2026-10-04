import { Router } from "express";
import * as ctrl from "./payment.controller";
import { requireAuth, requireAdmin, requireStudent } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { submitPaymentSchema } from "./payment.validation";

const router = Router();

router.get("/payments/mine", requireAuth, ctrl.getMyPayments);
router.get("/payments/:id", requireAuth, ctrl.getPaymentById);
router.post(
  "/payments/:bookingId",
  requireAuth,
  requireStudent,
  validateRequest(submitPaymentSchema),
  ctrl.submitPaymentProof,
);
router.get("/payments", requireAdmin, ctrl.getAllPayments);
router.patch("/payments/confirm/:paymentId", requireAdmin, ctrl.confirmPayment);

export default router;
