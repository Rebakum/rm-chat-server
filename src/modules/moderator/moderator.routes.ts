import { Router } from "express";
import * as ctrl from "./moderator.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import {
  createModeratorSchema,
  inviteModeratorSchema,
  tokenParamSchema,
  revokeModeratorSchema,
  grantPermissionSchema,
  revokePermissionSchema,
  userIdParamSchema,
  bulkPermissionsSchema,
  invitationIdParamSchema,
} from "./moderator.validation";

const router = Router();

router.get("/moderators", requireAuth, requireAdmin, ctrl.listModerators);
router.get("/moderators/invitations", requireAuth, requireAdmin, ctrl.listInvitations);
router.get("/moderators/audit-logs", requireAuth, requireAdmin, ctrl.listAuditLogs);
router.get("/moderators/stats", requireAuth, requireAdmin, ctrl.getDashboardStats);

router.get("/moderators/my-permissions", requireAuth, ctrl.getMyPermissions);

router.post("/moderators", requireAuth, requireAdmin, validateRequest(createModeratorSchema), ctrl.create);
router.post("/moderators/invite/:userId", requireAuth, requireAdmin, validateRequest(inviteModeratorSchema), ctrl.invite);
router.get("/moderators/invitation/:token", validateRequest(tokenParamSchema), ctrl.getInvitation);
router.post("/moderators/accept/:token", validateRequest(tokenParamSchema), ctrl.accept);
router.post("/moderators/reject/:token", validateRequest(tokenParamSchema), ctrl.reject);
router.delete("/moderators/:userId", requireAuth, requireAdmin, validateRequest(revokeModeratorSchema), ctrl.revoke);
router.delete("/moderators/invitation/:invitationId", requireAuth, requireAdmin, validateRequest(invitationIdParamSchema), ctrl.cancelInvitation);

router.get("/moderators/:userId/permissions", requireAuth, requireAdmin, validateRequest(userIdParamSchema), ctrl.listPermissions);
router.post("/moderators/:userId/permissions", requireAuth, requireAdmin, validateRequest(grantPermissionSchema), ctrl.grantPerm);
router.delete("/moderators/:userId/permissions", requireAuth, requireAdmin, validateRequest(revokePermissionSchema), ctrl.revokePerm);
router.patch("/moderators/:userId/permissions", requireAuth, requireAdmin, validateRequest(bulkPermissionsSchema), ctrl.bulkUpdatePermissions);

export default router;
