import { Router } from "express";
import * as ctrl from "./savedTeacher.controller";
import validateRequest from "../../middlewares/validateRequest";
import { saveTeacherSchema, unsaveTeacherSchema } from "./savedTeacher.validation";
import { requireAuth, requireStudent } from "../../middlewares/auth";

const router = Router();

router.post(
  "/",
  requireAuth,
  requireStudent,
  validateRequest(saveTeacherSchema),
  ctrl.saveTeacher,
);
router.delete(
  "/:teacherId",
  requireAuth,
  requireStudent,
  validateRequest(unsaveTeacherSchema),
  ctrl.unsaveTeacher,
);
router.get(
  "/",
  requireAuth,
  requireStudent,
  ctrl.getSavedTeachers,
);

export default router;
