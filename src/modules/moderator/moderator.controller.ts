import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import * as moderatorService from "./moderator.service";

const create = asyncHandler(async (req: Request, res: Response) => {
  const moderator = await moderatorService.createModerator(req.user!.id, req.body.email);
  ApiResponse.created(res, moderator, "Moderator created — credentials emailed");
});

const invite = asyncHandler(async (req: Request, res: Response) => {
  const result = await moderatorService.inviteModerator(
    req.user!.id,
    req.params.userId as string
  );
  ApiResponse.created(res, result, "Invitation created — token generated");
});

const accept = asyncHandler(async (req: Request, res: Response) => {
  const result = await moderatorService.acceptInvitation(req.params.token as string);
  ApiResponse.success(res, result, "Invitation accepted — user is now a moderator");
});

const reject = asyncHandler(async (req: Request, res: Response) => {
  await moderatorService.rejectInvitation(req.params.token as string);
  ApiResponse.success(res, null, "Invitation rejected");
});

const revoke = asyncHandler(async (req: Request, res: Response) => {
  await moderatorService.revokeModerator(req.user!.id, req.params.userId as string);
  ApiResponse.success(res, null, "Moderator revoked — role restored");
});

const getInvitation = asyncHandler(async (req: Request, res: Response) => {
  const invitation = await moderatorService.getInvitationByToken(req.params.token as string);
  ApiResponse.success(res, invitation);
});

const grantPerm = asyncHandler(async (req: Request, res: Response) => {
  const { permissionKey } = req.body;
  await moderatorService.grantPermission(req.user!.id, req.params.userId as string, permissionKey);
  ApiResponse.success(res, null, "Permission granted");
});

const revokePerm = asyncHandler(async (req: Request, res: Response) => {
  const { permissionKey } = req.body;
  await moderatorService.revokePermission(req.user!.id, req.params.userId as string, permissionKey);
  ApiResponse.success(res, null, "Permission revoked");
});

const listPermissions = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await moderatorService.getModeratorPermissions(req.params.userId as string);
  ApiResponse.success(res, permissions);
});

const bulkUpdatePermissions = asyncHandler(async (req: Request, res: Response) => {
  const { permissions } = req.body;
  const result = await moderatorService.bulkUpdatePermissions(
    req.user!.id,
    req.params.userId as string,
    permissions
  );
  ApiResponse.success(res, result, `Permissions updated: +${result.added} -${result.removed}`);
});

const listInvitations = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Number(String(req.query.limit ?? 20));
  const status = req.query.status as string | undefined;
  const { invitations, total } = await moderatorService.listInvitations(page, limit, status);
  ApiResponse.paginated(res, invitations, total, page, limit);
});

const listModerators = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Number(String(req.query.limit ?? 20));
  const { moderators, total } = await moderatorService.listModerators(page, limit);
  ApiResponse.paginated(res, moderators, total, page, limit);
});

const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Number(String(req.query.limit ?? 20));
  const filters = {
    targetUserId: req.query.targetUserId as string | undefined,
    action: req.query.action as string | undefined,
  };
  const { logs, total } = await moderatorService.listAuditLogs(page, limit, filters);
  ApiResponse.paginated(res, logs, total, page, limit);
});

const getMyPermissions = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await moderatorService.getModeratorPermissions(req.user!.id);
  ApiResponse.success(res, permissions);
});

const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await moderatorService.getDashboardStats();
  ApiResponse.success(res, stats);
});

const cancelInvitation = asyncHandler(async (req: Request, res: Response) => {
  await moderatorService.cancelInvitation(req.user!.id, req.params.invitationId as string);
  ApiResponse.success(res, null, "Invitation cancelled");
});

export {
  create,
  invite,
  accept,
  reject,
  cancelInvitation,
  revoke,
  getInvitation,
  grantPerm,
  revokePerm,
  listPermissions,
  bulkUpdatePermissions,
  listInvitations,
  listModerators,
  listAuditLogs,
  getMyPermissions,
  getDashboardStats,
};
