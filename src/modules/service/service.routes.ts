import { Router } from "express";
import * as ctrl from "./service.controller";
import { requireAuth, requireAdmin, requireTeacher } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createServiceSchema, updateServiceSchema } from "./service.validation";

const router = Router();

router.get("/services", ctrl.getAllServices);
router.get("/services/admin", requireAdmin, ctrl.getAllServicesAdmin);
router.get("/services/teacher/:teacherId", ctrl.getServicesByTeacher);
router.get("/services/:id", ctrl.getServiceById);
router.post("/services", requireAuth, requireTeacher, validateRequest(createServiceSchema), ctrl.createService);
router.patch("/services/:id", requireAuth, requireTeacher, validateRequest(updateServiceSchema), ctrl.updateService);
router.patch("/services/:id/accept", requireAdmin, ctrl.acceptService);
router.delete("/services/:id", requireAdmin, ctrl.deleteService);

export default router;
