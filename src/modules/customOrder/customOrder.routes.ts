import { Router } from "express";
import * as ctrl from "./customOrder.controller";
import { requireAuth, requireAdmin, requireStudent } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createCustomOrderSchema, updateStatusSchema } from "./customOrder.validation";

const router = Router();

router.get("/custom-orders", requireAdmin, ctrl.getAllCustomOrders);
router.get("/custom-orders/mine", requireAuth, ctrl.getMyCustomOrders);
router.get("/custom-orders/:id", requireAuth, ctrl.getCustomOrderById);
router.post(
  "/custom-orders",
  requireAuth,
  requireStudent,
  validateRequest(createCustomOrderSchema),
  ctrl.createCustomOrder
);
router.patch(
  "/custom-orders/:id/status",
  requireAuth,
  validateRequest(updateStatusSchema),
  ctrl.updateCustomOrderStatus
);

export default router;
