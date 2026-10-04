import { Router } from "express";
import * as ctrl from "./payout.controller";
import { requireAuth, requireAdmin, requireTeacher } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { requestPayoutSchema, markPaidSchema } from "./payout.validation";

const router = Router();

router.get("/payouts/teacher/:teacherId", requireAuth, requireTeacher, ctrl.getTeacherPayouts);
router.post("/payouts", requireAuth, requireTeacher, validateRequest(requestPayoutSchema), ctrl.requestPayout);
router.get("/payouts", requireAdmin, ctrl.getAllPayouts);
router.get("/payouts/:id", requireAdmin, ctrl.getPayoutById);
router.patch("/payouts/:id", requireAdmin, validateRequest(markPaidSchema), ctrl.markPayoutPaid);

export default router;
