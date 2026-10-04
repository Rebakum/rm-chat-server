import { Router } from "express";
import * as ctrl from "./enrollment.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { enrollSchema, updateStatusSchema } from "./enrollment.validation";

const router = Router();

router.post("/enrollments", requireAuth, validateRequest(enrollSchema), ctrl.enroll);
router.get("/enrollments/mine", requireAuth, ctrl.getMyEnrollments);
router.get("/enrollments/user/:userId", requireAuth, ctrl.getUserEnrollments);
router.get("/enrollments", requireAdmin, ctrl.getAllEnrollments);
router.patch("/enrollments/:id/status", requireAdmin, validateRequest(updateStatusSchema), ctrl.updateEnrollmentStatus);

export default router;
