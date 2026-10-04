import { Router } from "express";
import * as ctrl from "./teacherApplication.controller";
import { requireAuth, requireAdmin, requireStudent } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createTeacherApplicationSchema, reviewTeacherApplicationSchema } from "./teacherApplication.validation";

const router = Router();

router.get("/teacher-applications/mine", requireAuth, ctrl.getMyApplication);
router.post(
  "/teacher-applications",
  requireAuth,
  requireStudent,
  validateRequest(createTeacherApplicationSchema),
  ctrl.createApplication,
);
router.get("/admin/teacher-applications", requireAdmin, ctrl.listApplications);
router.patch(
  "/admin/teacher-applications/:id/status",
  requireAdmin,
  validateRequest(reviewTeacherApplicationSchema),
  ctrl.reviewApplication,
);

export default router;
