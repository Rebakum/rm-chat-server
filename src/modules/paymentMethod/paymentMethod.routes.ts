import { Router } from "express";
import * as ctrl from "./paymentMethod.controller";
import { requireAuth } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createPaymentMethodSchema, updatePaymentMethodSchema } from "./paymentMethod.validation";

const router = Router();

router.get("/payment-methods", requireAuth, ctrl.getMyPaymentMethods);
router.get("/payment-methods/:id", requireAuth, ctrl.getPaymentMethodById);
router.post(
  "/payment-methods",
  requireAuth,
  validateRequest(createPaymentMethodSchema),
  ctrl.createPaymentMethod
);
router.patch(
  "/payment-methods/:id",
  requireAuth,
  validateRequest(updatePaymentMethodSchema),
  ctrl.updatePaymentMethod
);
router.delete("/payment-methods/:id", requireAuth, ctrl.deletePaymentMethod);

export default router;
