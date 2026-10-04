import { Router } from "express";
import * as ctrl from "./call.controller";
import { requireAuth } from "../../middlewares/auth";
import { requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { initiateCallSchema, endCallSchema, getCallHistorySchema, getActiveCallSchema, getCallByIdSchema } from "./call.validation";

const router = Router();

router.post("/calls", requireAuth, validateRequest(initiateCallSchema), ctrl.initiateCall);
router.get("/calls/active", requireAuth, validateRequest(getActiveCallSchema), ctrl.getActiveCall);
router.get("/calls/:callId", requireAuth, validateRequest(getCallByIdSchema), ctrl.getCallById);
router.patch("/calls/:callId/end", requireAuth, validateRequest(endCallSchema), ctrl.endCall);
router.get("/calls", requireAuth, validateRequest(getCallHistorySchema), ctrl.getCallHistory);
// /admin/calls/live MUST be declared before /admin/calls/:chatId — otherwise
// Express matches "live" as the :chatId param and the live list is unreachable.
router.get("/admin/calls/live", requireAuth, requireAdmin, ctrl.getLiveCalls);
router.get("/admin/calls/detail/:callId", requireAuth, requireAdmin, ctrl.getCallDetailAdmin);
router.get("/admin/calls", requireAuth, requireAdmin, ctrl.getAllCallsAdmin);
router.get("/admin/calls/:chatId", requireAuth, requireAdmin, ctrl.getChatCallHistory);

export default router;
