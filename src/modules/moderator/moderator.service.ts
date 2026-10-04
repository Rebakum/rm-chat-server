import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import ApiError from "../../utils/ApiError";
import env from "../../config/env";
import { InvitationResponse, moderatorInvitationWithUser } from "./moderator.interface";
import { createNotification } from "../notification/notification.service";
import { sendModeratorInvitationEmail, sendModeratorActionEmail, sendModeratorCredentialsEmail } from "../../lib/mailer";

const INVITATION_TTL_HOURS = 72;

const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

// Mixed-case letters, digits, and a couple of symbols — no ambiguous
// characters (0/O, 1/l/I) since this gets typed in by hand on first login.
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
const generateTempPassword = (length = 14): string => {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) password += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  return password;
};

const createModerator = async (
  adminId: string,
  email: string
): Promise<{ id: string; email: string; name: string | null }> => {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const tempPassword = generateTempPassword();
  const hashedPassword = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      role: "moderator",
      previousRole: "student",
      status: "accepted",
      emailVerified: true,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hashedPassword,
    },
  });

  await prisma.moderatorAuditLog.create({
    data: {
      actorId: adminId,
      action: "MODERATOR_CREATED_DIRECT",
      targetUserId: user.id,
      metadata: { email: normalizedEmail },
    },
  });

  try {
    const loginUrl = `${env.CLIENT_URL.split(",")[0].trim()}/login`;
    await sendModeratorCredentialsEmail(normalizedEmail, tempPassword, loginUrl);
  } catch (err) {
  }

  return { id: user.id, email: user.email, name: user.name };
};

const invalidateUserSessions = async (userId: string): Promise<number> => {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
};

const inviteModerator = async (
  adminId: string,
  targetUserId: string
): Promise<InvitationResponse> => {
  if (adminId === targetUserId) {
    throw ApiError.badRequest("Cannot invite yourself");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, name: true, email: true },
  });

  if (!targetUser) throw ApiError.notFound("User not found");

  if (targetUser.role === "admin") {
    throw ApiError.badRequest("Cannot invite an admin");
  }

  if (targetUser.role === "moderator") {
    throw ApiError.badRequest("User is already a moderator");
  }

  const pendingInvitation = await prisma.moderatorInvitation.findFirst({
    where: { userId: targetUserId, status: "PENDING" },
  });

  if (pendingInvitation) {
    throw ApiError.conflict("A pending invitation already exists for this user");
  }

  const plaintext = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(plaintext);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + INVITATION_TTL_HOURS);

  const invitation = await prisma.moderatorInvitation.create({
    data: {
      userId: targetUserId,
      invitedByAdminId: adminId,
      tokenHash,
      expiresAt,
    },
  });

  await prisma.moderatorAuditLog.create({
    data: {
      actorId: adminId,
      action: "MODERATOR_INVITED",
      targetUserId,
      metadata: { invitationId: invitation.id },
    },
  });

  // Fire-and-forget: notification + email (fail silently)
  try {
    const acceptUrl = `${env.CLIENT_URL}/moderators/accept/${plaintext}`;
    const rejectUrl = `${env.CLIENT_URL}/moderators/reject/${plaintext}`;

    await createNotification(
      targetUserId,
      "MODERATOR_INVITATION",
      "You have been invited to become a Moderator at Rahmah Institute.",
      { invitationId: invitation.id, acceptUrl, rejectUrl, expiresAt: expiresAt.toISOString() }
    );

    await sendModeratorInvitationEmail(
      targetUser.email,
      targetUser.name || targetUser.email,
      acceptUrl,
      rejectUrl,
      expiresAt
    );
  } catch (err) {
  }

  return {
    invitationId: invitation.id,
    token: plaintext,
    expiresAt: invitation.expiresAt,
  };
};

const acceptInvitation = async (
  token: string
): Promise<{ user: { id: string; email: string; name: string | null; role: string } }> => {
  const tokenHash = hashToken(token);

  const invitation = await prisma.moderatorInvitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) throw ApiError.notFound("Invalid invitation token");

  if (invitation.status !== "PENDING") {
    throw ApiError.badRequest(`Invitation already ${invitation.status.toLowerCase()}`);
  }

  if (new Date() > invitation.expiresAt) {
    await prisma.moderatorInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    throw ApiError.badRequest("Invitation has expired");
  }

  const user = await prisma.user.findUnique({ where: { id: invitation.userId } });
  if (!user) throw ApiError.notFound("User not found");

  const [, updatedUser] = await prisma.$transaction([
    prisma.moderatorInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: invitation.userId },
      data: { role: "moderator", previousRole: user.role, status: "accepted" },
    }),
    prisma.moderatorAuditLog.create({
      data: {
        actorId: invitation.userId,
        action: "INVITATION_ACCEPTED",
        targetUserId: invitation.userId,
        metadata: { invitationId: invitation.id },
      },
    }),
  ]);

  await invalidateUserSessions(invitation.userId);

  // Fire-and-forget: notify admin + email
  try {
    const admin = await prisma.user.findUnique({
      where: { id: invitation.invitedByAdminId },
      select: { id: true, email: true, name: true },
    });

    if (admin) {
      await createNotification(
        admin.id,
        "MODERATOR_INVITATION_ACCEPTED",
        `${updatedUser.name || updatedUser.email} has accepted the moderator invitation.`,
        { userId: updatedUser.id, email: updatedUser.email }
      );
      await sendModeratorActionEmail(admin.email, updatedUser.name || updatedUser.email, "accepted");
    }
  } catch (err) {
  }

  return {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    },
  };
};

const rejectInvitation = async (token: string): Promise<void> => {
  const tokenHash = hashToken(token);

  const invitation = await prisma.moderatorInvitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) throw ApiError.notFound("Invalid invitation token");

  if (invitation.status !== "PENDING") {
    throw ApiError.badRequest(`Invitation already ${invitation.status.toLowerCase()}`);
  }

  await prisma.$transaction([
    prisma.moderatorInvitation.update({
      where: { id: invitation.id },
      data: { status: "REJECTED", rejectedAt: new Date() },
    }),
    prisma.moderatorAuditLog.create({
      data: {
        actorId: invitation.userId,
        action: "INVITATION_REJECTED",
        targetUserId: invitation.userId,
        metadata: { invitationId: invitation.id },
      },
    }),
  ]);

  // Fire-and-forget: notify admin + email
  try {
    const [user, admin] = await Promise.all([
      prisma.user.findUnique({ where: { id: invitation.userId }, select: { name: true, email: true } }),
      prisma.user.findUnique({ where: { id: invitation.invitedByAdminId }, select: { id: true, email: true } }),
    ]);

    if (admin && user) {
      await createNotification(
        admin.id,
        "MODERATOR_INVITATION_REJECTED",
        `${user.name || user.email} has rejected the moderator invitation.`,
        { userId: invitation.userId, email: user.email }
      );
      await sendModeratorActionEmail(admin.email, user.name || user.email, "rejected");
    }
  } catch (err) {
  }
};

const revokeModerator = async (
  adminId: string,
  targetUserId: string
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw ApiError.notFound("User not found");

  if (user.role !== "moderator") {
    throw ApiError.badRequest("User is not a moderator");
  }

  const restoredRole = user.previousRole || "student";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { role: restoredRole, previousRole: null },
    }),
    prisma.moderatorPermission.deleteMany({
      where: { userId: targetUserId },
    }),
    prisma.moderatorAuditLog.create({
      data: {
        actorId: adminId,
        action: "MODERATOR_REVOKED",
        targetUserId,
        metadata: { restoredRole },
      },
    }),
  ]);

  await invalidateUserSessions(targetUserId);

  // Fire-and-forget: notify affected user + email
  try {
    await createNotification(
      targetUserId,
      "MODERATOR_REVOKED",
      "Your moderator access has been revoked by an administrator.",
      { restoredRole, revokedByAdminId: adminId }
    );
    await sendModeratorActionEmail(user.email, user.name || user.email, "revoked");
  } catch (err) {
  }
};

const getInvitationByToken = async (
  token: string
): Promise<moderatorInvitationWithUser> => {
  const tokenHash = hashToken(token);

  const invitation = await prisma.moderatorInvitation.findUnique({
    where: { tokenHash },
    include: {
      invitedUser: { select: { id: true, name: true, email: true, role: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!invitation) throw ApiError.notFound("Invalid invitation token");

  return invitation as moderatorInvitationWithUser;
};

const grantPermission = async (
  adminId: string,
  userId: string,
  permissionKey: string
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role !== "moderator") throw ApiError.badRequest("User is not a moderator");

  const existing = await prisma.moderatorPermission.findFirst({
    where: { userId, permissionKey },
  });

  if (existing) {
    if (existing.granted) throw ApiError.conflict("Permission already granted");
    await prisma.moderatorPermission.update({
      where: { id: existing.id },
      data: { granted: true, grantedByAdminId: adminId },
    });
  } else {
    await prisma.moderatorPermission.create({
      data: { userId, permissionKey, granted: true, grantedByAdminId: adminId },
    });
  }

  await prisma.moderatorAuditLog.create({
    data: {
      actorId: adminId,
      action: "PERMISSION_GRANTED",
      targetUserId: userId,
      metadata: { permissionKey },
    },
  });
};

const revokePermission = async (
  adminId: string,
  userId: string,
  permissionKey: string
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role !== "moderator") throw ApiError.badRequest("User is not a moderator");

  const existing = await prisma.moderatorPermission.findFirst({
    where: { userId, permissionKey, granted: true },
  });

  if (!existing) throw ApiError.notFound("Permission not found");

  await prisma.moderatorPermission.delete({ where: { id: existing.id } });

  await prisma.moderatorAuditLog.create({
    data: {
      actorId: adminId,
      action: "PERMISSION_REVOKED",
      targetUserId: userId,
      metadata: { permissionKey },
    },
  });
};

const getModeratorPermissions = async (
  userId: string
): Promise<{ permissionKey: string; granted: boolean; grantedAt: Date }[]> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role !== "moderator") throw ApiError.badRequest("User is not a moderator");

  const perms = await prisma.moderatorPermission.findMany({
    where: { userId, granted: true },
    select: { permissionKey: true, granted: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return perms.map((p) => ({
    permissionKey: p.permissionKey,
    granted: p.granted,
    grantedAt: p.createdAt,
  }));
};

const bulkUpdatePermissions = async (
  adminId: string,
  userId: string,
  permissionKeys: string[]
): Promise<{ added: number; removed: number }> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role !== "moderator") throw ApiError.badRequest("User is not a moderator");

  const currentPerms = await prisma.moderatorPermission.findMany({
    where: { userId },
  });

  const currentSet = new Set(currentPerms.map((p) => p.permissionKey));
  const newSet = new Set(permissionKeys);

  const toAdd = permissionKeys.filter((k) => !currentSet.has(k));
  const toRemove = currentPerms.filter((p) => !newSet.has(p.permissionKey));

  await prisma.$transaction([
    ...(toAdd.length > 0
      ? [
          prisma.moderatorPermission.createMany({
            data: toAdd.map((key) => ({
              userId,
              permissionKey: key,
              granted: true,
              grantedByAdminId: adminId,
            })),
          }),
        ]
      : []),
    ...(toRemove.length > 0
      ? [
          prisma.moderatorPermission.deleteMany({
            where: { userId, permissionKey: { in: toRemove.map((p) => p.permissionKey) } },
          }),
        ]
      : []),
    prisma.moderatorAuditLog.create({
      data: {
        actorId: adminId,
        action: "PERMISSIONS_BULK_UPDATED",
        targetUserId: userId,
        metadata: { added: toAdd, removed: toRemove.map((p) => p.permissionKey) },
      },
    }),
  ]);

  return { added: toAdd.length, removed: toRemove.length };
};

const getDashboardStats = async () => {
  const [invitationCounts, activeModeratorCount, recentInvitations] = await Promise.all([
    prisma.moderatorInvitation.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.user.count({ where: { role: "moderator" } }),
    prisma.moderatorInvitation.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        invitedUser: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {
    PENDING: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    EXPIRED: 0,
    CANCELLED: 0,
  };
  for (const row of invitationCounts) {
    statusCounts[row.status] = row._count.status;
  }

  return {
    statusCounts,
    activeModeratorCount,
    recentInvitations,
  };
};

const cancelInvitation = async (adminId: string, invitationId: string): Promise<void> => {
  const invitation = await prisma.moderatorInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) throw ApiError.notFound("Invitation not found");

  if (invitation.status !== "PENDING") {
    throw ApiError.badRequest(`Invitation is already ${invitation.status.toLowerCase()}`);
  }

  await prisma.$transaction([
    prisma.moderatorInvitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" },
    }),
    prisma.moderatorAuditLog.create({
      data: {
        actorId: adminId,
        action: "INVITATION_CANCELLED",
        targetUserId: invitation.userId,
        metadata: { invitationId },
      },
    }),
  ]);

  try {
    await createNotification(
      invitation.userId,
      "MODERATOR_INVITATION_CANCELLED",
      "The moderator invitation has been cancelled by an administrator.",
      { cancelledByAdminId: adminId }
    );
  } catch (err) {
  }
};

const listInvitations = async (
  page: number = 1,
  limit: number = 20,
  status?: string
) => {
  const { skip, take } = paginate({}, page, limit);

  const where = status ? { status } : {};

  const [invitations, total] = await Promise.all([
    prisma.moderatorInvitation.findMany({
      where,
      include: {
        invitedUser: { select: { id: true, name: true, email: true, role: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.moderatorInvitation.count({ where }),
  ]);

  return { invitations, total };
};

const listModerators = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);

  const where = { role: "moderator" };

  const [moderators, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        previousRole: true,
        status: true,
        createdAt: true,
        moderatorPermissions: {
          select: { permissionKey: true, granted: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    moderators: moderators.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      previousRole: m.previousRole,
      status: m.status,
      createdAt: m.createdAt,
      permissions: m.moderatorPermissions,
    })),
    total,
  };
};

const listAuditLogs = async (
  page: number = 1,
  limit: number = 20,
  filters: { targetUserId?: string; action?: string } = {}
) => {
  const { skip, take } = paginate({}, page, limit);

  const where: Record<string, unknown> = {};
  if (filters.targetUserId) where.targetUserId = filters.targetUserId;
  if (filters.action) where.action = filters.action;

  const [logs, total] = await Promise.all([
    prisma.moderatorAuditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        targetUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.moderatorAuditLog.count({ where }),
  ]);

  return { logs, total };
};

export {
  createModerator,
  inviteModerator,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  revokeModerator,
  getInvitationByToken,
  grantPermission,
  revokePermission,
  getModeratorPermissions,
  bulkUpdatePermissions,
  invalidateUserSessions,
  getDashboardStats,
  listInvitations,
  listModerators,
  listAuditLogs,
};
