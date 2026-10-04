import { Router } from "express";
import * as ctrl from "./job.controller";
import { requireAuth, requireTeacher, requireStudent } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createJobSchema, applyToJobSchema, updateJobStatusSchema } from "./job.validation";

const router = Router();

router.get("/jobs", ctrl.getAllJobs);
router.get("/jobs/mine", requireAuth, ctrl.getMyJobs);
router.get("/jobs/teacher/applications", requireAuth, requireTeacher, ctrl.getTeacherApplications);
router.get("/jobs/:id", ctrl.getJobById);
router.post("/jobs", requireAuth, requireStudent, validateRequest(createJobSchema), ctrl.createJob);
router.patch("/jobs/apply/:jobId", requireAuth, requireTeacher, validateRequest(applyToJobSchema), ctrl.applyToJob);
router.patch("/jobs/status/:jobId", requireAuth, validateRequest(updateJobStatusSchema), ctrl.updateJobStatus);

export default router;
