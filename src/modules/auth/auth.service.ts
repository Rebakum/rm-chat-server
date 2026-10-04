import { fromNodeHeaders } from "better-auth/node";
import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@prisma/client";
import auth from "../../lib/auth";
import env from "../../config/env";
import logger from "../../lib/logger";
import prisma from "../../lib/prisma";
import { sendOTPEmail } from "../../lib/mailer";
import { emitToAdmins } from "../../sockets";
import ApiError from "../../utils/ApiError";
import { AuthenticatedUser, SessionSummary } from "./auth.interface";
import {
  MAX_OTP_ATTEMPTS,
  generateOtp,
  matchesOtp,
  otpExpiresAt,
  otpTtlSeconds,
  parsePending,
  pendingIdentifier,
  serializePending,
} from "./auth.helper";

// ---- Signup / OTP verification / Login -----------------------------------

interface SignupPendingResult {
  email: string;
  requiresVerification: boolean;
  otpExpiresInSeconds?: number;
}

/**
 * Adds email/password credentials to a pre-provisioned student/teacher.
 * `cleanupIdentifier` consumes the OTP in the same transaction so it cannot
 * be used to attach more than one credential.
 */
const addCredentialToExistingUser = async (
  userId: string,
  email: string,
  hashedPassword: string,
  cleanupIdentifier?: string,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, displayName: true, role: true, status: true },
    });
    if (!user || user.email !== email || !["student", "teacher"].includes(user.role)) {
      throw ApiError.forbidden("Only pre-registered Rahmah students and teachers can create login credentials.");
    }
    if (user.status === "rejected" || user.status === "banned") {
      throw ApiError.forbidden("This account has been rejected and cannot create login credentials.");
    }
    const existingCredential = await tx.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    });
    if (existingCredential) {
      throw ApiError.conflict("This account already has a password. Please sign in.");
    }

    if (cleanupIdentifier) {
      await tx.verification.deleteMany({ where: { identifier: cleanupIdentifier } });
    }
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { emailVerified: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        emailVerified: true,
      },
    });
    await tx.account.create({
      data: {
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
      },
    });
    const displayName = user.displayName || user.name || user.email;
    const auditLog = await tx.moderatorAuditLog.create({
      data: {
        action: "USER_REGISTERED",
        targetUserId: user.id,
        metadata: {
          displayName,
          email: user.email,
          role: user.role,
          detail: `New user registered: ${displayName}`,
        },
      },
      select: { id: true, createdAt: true },
    });
    return { user: updatedUser, displayName, auditLog };
  });
  emitToAdmins("admin:notification", {
    id: result.auditLog.id,
    action: "USER_REGISTERED",
    targetId: result.user.id,
    detail: `New user registered: ${result.displayName}`,
    createdAt: result.auditLog.createdAt.toISOString(),
  });
  return result.user;
};

const createStudentAccount = async (
  name: string,
  email: string,
  hashedPassword: string,
  cleanupIdentifier?: string,
) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) {
        throw ApiError.conflict("An account with this email already exists. Please sign in.");
      }

      if (cleanupIdentifier) {
        await tx.verification.deleteMany({ where: { identifier: cleanupIdentifier } });
      }
      const user = await tx.user.create({
        data: {
          name,
          email,
          role: "student",
          status: "accepted",
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          emailVerified: true,
        },
      });
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
      const displayName = name || email;
      const auditLog = await tx.moderatorAuditLog.create({
        data: {
          action: "USER_REGISTERED",
          targetUserId: user.id,
          metadata: {
            displayName,
            email,
            role: user.role,
            detail: `New user registered: ${displayName}`,
          },
        },
        select: { id: true, createdAt: true },
      });
      return { user, displayName, auditLog };
    });

    emitToAdmins("admin:notification", {
      id: result.auditLog.id,
      action: "USER_REGISTERED",
      targetId: result.user.id,
      detail: `New user registered: ${result.displayName}`,
      createdAt: result.auditLog.createdAt.toISOString(),
    });
    return result.user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw ApiError.conflict("An account with this email already exists. Please sign in.");
    }
    throw error;
  }
};

const signup = async (
  name: string,
  email: string,
  password: string,
): Promise<SignupPendingResult> => {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, role: true, status: true },
  });

  if (existing && existing.role !== "student" && existing.role !== "teacher") {
    throw ApiError.forbidden("Only pre-registered Rahmah students and teachers can create login credentials.");
  }
  if (existing && (existing.status === "rejected" || existing.status === "banned")) {
    throw ApiError.forbidden("This account has been rejected and cannot create login credentials.");
  }
  if (existing) {
    const credential = await prisma.account.findFirst({
      where: { userId: existing.id, providerId: "credential" },
      select: { id: true },
    });
    if (credential) throw ApiError.conflict("An account with this email already exists. Please sign in.");
  }

  const hashedPassword = await hashPassword(password);

  if (!env.REQUIRE_EMAIL_VERIFICATION) {
    const user = existing
      ? await addCredentialToExistingUser(existing.id, normalizedEmail, hashedPassword)
      : await createStudentAccount(trimmedName, normalizedEmail, hashedPassword);
    logger.info("[signup] account created without OTP (REQUIRE_EMAIL_VERIFICATION=false)", {
      email: normalizedEmail,
      userId: user.id,
    });
    return { email: normalizedEmail, requiresVerification: false };
  }

  const otp = generateOtp();
  const identifier = pendingIdentifier(normalizedEmail);

  await prisma.$transaction([
    prisma.verification.deleteMany({ where: { identifier } }),
    prisma.verification.create({
      data: {
        identifier,
        value: serializePending({
          email: normalizedEmail,
          name: trimmedName,
          ...(existing ? { existingUserId: existing.id } : {}),
          hashedPassword,
          otp,
          attempts: 0,
          requestedAt: new Date().toISOString(),
        }),
        expiresAt: otpExpiresAt(),
      },
    }),
  ]);

  const sent = await sendOTPEmail(normalizedEmail, trimmedName, otp, "email-verification");
  if (!sent) {
    logger.error("[signup] OTP email could not be sent", { email: normalizedEmail });
    throw new ApiError(502, "We could not send the verification email. Please try again.");
  }

  logger.info("[signup] pending signup stored, no user row created yet", {
    email: normalizedEmail,
    ttlSeconds: otpTtlSeconds(),
  });

  return {
    email: normalizedEmail,
    requiresVerification: true,
    otpExpiresInSeconds: otpTtlSeconds(),
  };
};

const verifyOtp = async (email: string, otp: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const identifier = pendingIdentifier(normalizedEmail);

  const record = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    const alreadyVerified = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { emailVerified: true },
    });
    if (alreadyVerified?.emailVerified) {
      throw ApiError.conflict("This email is already verified. Please sign in.");
    }
    throw ApiError.badRequest("No verification code requested for this email. Please sign up first.");
  }

  if (record.expiresAt < new Date()) {
    await prisma.verification.deleteMany({ where: { identifier } });
    logger.info("[verifyOtp] expired OTP discarded", { email: normalizedEmail });
    throw ApiError.badRequest("OTP expired. Please sign up again to request a new code.");
  }

  const pending = parsePending(record.value);
  if (!pending) {
    await prisma.verification.deleteMany({ where: { identifier } });
    throw ApiError.badRequest("Invalid verification data. Please sign up again.");
  }

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.verification.deleteMany({ where: { identifier } });
    throw ApiError.badRequest("Too many incorrect attempts. Please sign up again to request a new code.");
  }

  if (!matchesOtp(pending.otp, otp)) {
    const attempts = pending.attempts + 1;
    await prisma.verification.update({
      where: { id: record.id },
      data: { value: serializePending({ ...pending, attempts }) },
    });

    const remaining = MAX_OTP_ATTEMPTS - attempts;
    logger.warn("[verifyOtp] incorrect OTP", { email: normalizedEmail, attempts, remaining });

    throw ApiError.badRequest(
      remaining > 0
        ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please sign up again to request a new code.",
    );
  }

  // Create a student or attach credentials to a pre-provisioned student/teacher.
  const user = pending.existingUserId
    ? await addCredentialToExistingUser(
        pending.existingUserId,
        normalizedEmail,
        pending.hashedPassword,
        identifier,
      )
    : await createStudentAccount(pending.name, normalizedEmail, pending.hashedPassword, identifier);

  logger.info("[verifyOtp] OTP accepted, signup completed", {
    email: normalizedEmail,
    userId: user.id,
  });

  return user;
};

const resendOtp = async (email: string): Promise<{ email: string; otpExpiresInSeconds: number }> => {
  const normalizedEmail = email.toLowerCase().trim();
  const identifier = pendingIdentifier(normalizedEmail);

  const record = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });

  if (record) {
    const pending = parsePending(record.value);
    if (!pending) {
      await prisma.verification.deleteMany({ where: { identifier } });
      throw ApiError.badRequest("This signup is no longer valid. Please sign up again.");
    }

    const otp = generateOtp();
    await prisma.verification.update({
      where: { id: record.id },
      data: {
        value: serializePending({
          ...pending,
          otp,
          attempts: 0,
          requestedAt: new Date().toISOString(),
        }),
        expiresAt: otpExpiresAt(),
      },
    });

    const sent = await sendOTPEmail(normalizedEmail, pending.name, otp, "email-verification");
    if (!sent) {
      logger.error("[resendOtp] OTP email could not be sent", { email: normalizedEmail });
      throw new ApiError(502, "We could not send the verification email. Please try again.");
    }

    logger.info("[resendOtp] new OTP issued for pending signup", { email: normalizedEmail });
    return { email: normalizedEmail, otpExpiresInSeconds: otpTtlSeconds() };
  }

  // No pending signup: fall back to Better Auth's OTP store for accounts that
  // were created through other paths (e.g. social login) and still unverified.
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { emailVerified: true },
  });

  if (existing?.emailVerified) {
    throw ApiError.badRequest("This email is already verified. Please sign in.");
  }

  if (existing) {
    try {
      await (auth.api as any).sendVerificationOTP({
        body: { email: normalizedEmail, type: "email-verification" },
      });
      return { email: normalizedEmail, otpExpiresInSeconds: otpTtlSeconds() };
    } catch (error) {
      logger.warn("[resendOtp] Better Auth resend failed", { email: normalizedEmail, error });
      throw ApiError.badRequest("Could not resend the verification code. Please try again.");
    }
  }

  throw ApiError.badRequest("No signup in progress for this email. Please sign up first.");
};

const recordFirstLogin = async (
  userId: string,
  email: string,
  displayName: string,
  role: string,
): Promise<void> => {
  const auditLog = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const priorRegistration = await tx.moderatorAuditLog.findFirst({
      where: {
        targetUserId: userId,
        action: { in: ["USER_REGISTERED", "USER_FIRST_LOGIN"] },
      },
      select: { id: true },
    });
    if (priorRegistration) return null;

    return tx.moderatorAuditLog.create({
      data: {
        action: "USER_FIRST_LOGIN",
        targetUserId: userId,
        metadata: {
          displayName,
          email,
          role,
          detail: `First login: ${displayName}`,
        },
      },
      select: { id: true, createdAt: true },
    });
  });
  if (auditLog) {
    emitToAdmins("admin:notification", {
      id: auditLog.id,
      action: "USER_FIRST_LOGIN",
      targetId: userId,
      detail: `First login: ${displayName}`,
      createdAt: auditLog.createdAt.toISOString(),
    });
  }
};

const requestPasswordReset = async (email: string) => {
  await auth.api.requestPasswordReset({
    body: {
      email: email.toLowerCase().trim(),
      redirectTo: `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password`,
    },
  } as any);
};

const resetPassword = async (token: string, newPassword: string) => {
  await auth.api.resetPassword({ body: { token, newPassword } } as any);
};

const login = async (email: string, password: string) => {
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      role: true,
      status: true,
      name: true,
    },
  });

  if (!existingUser) {
    throw new ApiError(401, "No account found for this email. Please sign up first.");
  }

  if (!["student", "teacher", "moderator", "admin"].includes(existingUser.role)) {
    throw new ApiError(403, "This account is not eligible to sign in.");
  }
  if (existingUser.status === "rejected" || existingUser.status === "banned") {
    throw new ApiError(403, "This account has been rejected and cannot sign in. Contact an administrator.");
  }

  if (existingUser.emailVerified === false || existingUser.emailVerified === null) {
    throw new ApiError(403, "Please verify your email before logging in.");
  }

  const response = await auth.api.signInEmail({
    body: { email: normalizedEmail, password },
    asResponse: true,
  } as any);

  const setCookieHeaders: string[] =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  if (setCookieHeaders.length === 0) {
    const raw = response.headers.get("set-cookie");
    if (raw) setCookieHeaders.push(raw);
  }

  const body = (await response.json()) as Record<string, any>;

  logger.debug("[login] Better Auth response:", {
    status: response.status,
    ok: response.ok,
    hasUser: !!body?.user,
    hasSession: !!body?.session,
    message: body?.message,
    keys: body ? Object.keys(body) : [],
  });

  if (!response.ok) {
    const msg = body?.message ?? body?.error?.message ?? "Invalid credentials";
    throw new ApiError(401, msg);
  }

  const user = body?.user;

  if (!user) {
    logger.error("[login] No user in response:", {
      email: normalizedEmail,
      message: body?.message,
    });
    throw new ApiError(401, "Login failed — user not found in response");
  }

  if (
    existingUser.status === "pending" &&
    (existingUser.role === "student" || existingUser.role === "teacher")
  ) {
    await prisma.user.updateMany({
      where: { id: existingUser.id, status: "pending" },
      data: { status: "accepted" },
    });
  }
  const currentStatus = await prisma.user.findUnique({
    where: { id: existingUser.id },
    select: { status: true },
  });
  if (currentStatus?.status === "rejected" || currentStatus?.status === "banned") {
    const sessionToken = body?.token ?? body?.session?.token;
    if (typeof sessionToken === "string") {
      await prisma.session.deleteMany({ where: { token: sessionToken } });
    }
    throw new ApiError(403, "This account has been rejected and cannot sign in. Contact an administrator.");
  }
  user.status = currentStatus?.status ?? existingUser.status;
  if (existingUser.role === "student" || existingUser.role === "teacher") {
    await recordFirstLogin(
      existingUser.id,
      existingUser.email,
      user.name || existingUser.name || existingUser.email,
      existingUser.role,
    );
  }

  const sessionToken = body?.token ?? body?.session?.token;
  const { password: _, hash: __, ...safeUser } = user;
  return { user: { ...safeUser, token: sessionToken }, setCookieHeaders };
};

const refreshToken = async (headers: Record<string, string | string[] | undefined>) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
  if (!session) throw new ApiError(401, "Session expired or invalid — please log in again");
  return session;
};

// ---- Profile / sessions / logout ------------------------------------------

const getFullProfile = async (userId: string): Promise<AuthenticatedUser> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    photoURL: user.photoURL,
    image: user.image,
    lastSeen: user.lastSeen,
    createdAt: user.createdAt,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
  };
};

const listSessions = async (userId: string, currentToken: string): Promise<SessionSummary[]> => {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    isCurrent: s.token === currentToken,
  }));
};

const revokeSession = async (userId: string, sessionId: string): Promise<void> => {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new ApiError(404, "Session not found");
  }
  await prisma.session.delete({ where: { id: sessionId } });
};

const logoutAllDevices = async (userId: string): Promise<number> => {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
};

const revokeAllOtherSessions = async (userId: string, currentToken: string): Promise<number> => {
  const { count } = await prisma.session.deleteMany({
    where: { userId, NOT: { token: currentToken } },
  });
  return count;
};

export default {
  signup,
  verifyOtp,
  resendOtp,
  requestPasswordReset,
  resetPassword,
  login,
  refreshToken,
  getFullProfile,
  listSessions,
  revokeSession,
  logoutAllDevices,
  revokeAllOtherSessions,
};