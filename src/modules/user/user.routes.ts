import { Router } from "express";
import * as ctrl from "./user.controller";
import { requireAuth, requireAdmin, requirePermission, requireTeacher } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { updateUserProfileSchema, updateUserStatusSchema } from "./user.validation";

const router = Router();

router.get("/teacher/dashboard", requireAuth, requireTeacher, ctrl.getTeacherDashboard);
router.get("/online-teachers", ctrl.getOnlineTeachers);
router.get("/eligible-teachers", ctrl.getEligibleTeachers);
router.get("/eligible-teachers/:id", ctrl.getEligibleTeacherById);

router.get("/users/:id", requireAuth, ctrl.getUserById);
router.patch("/users/:id", requireAuth, validateRequest(updateUserProfileSchema), ctrl.updateUserField);

router.get("/users", requireAuth, requirePermission("MANAGE_STUDENTS"), ctrl.getAllUsers);
router.get("/online-users", requireAdmin, ctrl.getOnlineUsers);
router.get("/verified-students", requireAdmin, ctrl.getVerifiedStudents);
router.patch("/users/:id/status", requireAdmin, validateRequest(updateUserStatusSchema), ctrl.updateUserStatus);
router.delete("/users/:id", requireAdmin, ctrl.deleteUser);
router.post("/send-welcome-email", requireAdmin, ctrl.sendWelcome);

export default router;
