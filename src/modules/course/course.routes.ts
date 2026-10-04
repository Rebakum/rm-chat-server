import { Router } from "express";
import * as ctrl from "./course.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createCourseSchema } from "./course.validation";

const router = Router();

router.get("/courses/public", ctrl.getPublicCourses);
router.get("/courses/public/:name", ctrl.getCoursesByName);
router.post("/courses", validateRequest(createCourseSchema), ctrl.createCourse);
router.get("/courses", requireAdmin, ctrl.getAllCourses);
router.get("/courses/:id", requireAdmin, ctrl.getCourseById);
router.patch("/courses/:id", requireAdmin, ctrl.updateCourse);
router.delete("/courses/:id", requireAdmin, ctrl.deleteCourse);

export default router;
