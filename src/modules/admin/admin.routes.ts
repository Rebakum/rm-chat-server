import { Router } from "express";
import * as ctrl from "./admin.controller";
import { requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { updateTeacherStatusSchema, updateTeacherPaymentStatusSchema } from "./admin.validation";

const router = Router();

router.get("/admin/teachers", requireAdmin, ctrl.getAllTeachers);
router.get("/admin/teachers/:teacherId", requireAdmin, ctrl.getTeacherById);
router.patch("/admin/teachers/:teacherId/status", requireAdmin, validateRequest(updateTeacherStatusSchema), ctrl.updateTeacherStatus);
router.patch("/admin/teachers/:teacherId/payment-status", requireAdmin, validateRequest(updateTeacherPaymentStatusSchema), ctrl.updateTeacherPaymentStatus);
router.get("/admin/users", requireAdmin, ctrl.getAllUsers);
router.get("/admin/stats", requireAdmin, ctrl.getDashboardStats);
router.get("/admin/overview", requireAdmin, ctrl.getDashboardOverview);
router.get("/admin/badges", requireAdmin, ctrl.getSidebarBadges);
router.get("/admin/registry-audit", requireAdmin, ctrl.getRegistryAudit);
router.patch("/admin/users/:id/verify", requireAdmin, ctrl.forceVerifyUser);
router.post("/admin/users/:id/send-verification-email", requireAdmin, ctrl.sendVerificationEmail);

export default router;
