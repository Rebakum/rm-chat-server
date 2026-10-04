import { Router } from "express";
import * as ctrl from "./dawra.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createDawraSchema, addMonthlyFeeSchema } from "./dawra.validation";

const router = Router();

router.get("/dawras", requireAdmin, ctrl.getAllDawras);
router.get("/dawras/:id", requireAuth, ctrl.getDawraById);
router.post("/dawras", requireAuth, validateRequest(createDawraSchema), ctrl.createDawra);
router.patch("/dawras/:id", requireAuth, ctrl.updateDawra);
router.post("/dawras/:id/monthly-fee", requireAuth, validateRequest(addMonthlyFeeSchema), ctrl.addMonthlyFee);

export default router;
