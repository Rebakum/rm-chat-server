import { Router } from "express";
import * as ctrl from "./eps.controller";
import { requireAuth } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { initiateEpsSchema } from "./eps.validation";

const router = Router();

router.post("/eps/initiate", requireAuth, validateRequest(initiateEpsSchema), ctrl.initiateEpsPayment);
router.all("/eps/success", ctrl.handleEpsSuccess);
router.all("/eps/fail", ctrl.handleEpsFail);
router.all("/eps/cancel", ctrl.handleEpsCancel);
router.get("/eps/purchase/:transactionId", requireAuth, ctrl.getEpsPurchaseData);

export default router;
