import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../lib/auth";
import prisma from "../lib/prisma";

// Many routes chain `requireAuth, requireTeacher` (or requireStudent /
// requireAdmin) back to back. Each of those middlewares used to call
// auth.api.getSession() independently, so a single request paid for two
// full session lookups (each one a round trip to the session store /
// database) to answer the same "who is this?" question. This helper looks
// up the session once and reuses it if an earlier middleware in the chain
// (typically requireAuth) already populated req.user/req.session.
const getSessionOnce = async (req: Request) => {
  const session =
    req.user && req.session
      ? { user: req.user, session: req.session }
      : await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });
  if (!account || account.status === "rejected" || account.status === "banned") {
    throw new Error("This account has been rejected or disabled.");
  }
  return session;
};

/**
 * Verifies the Better Auth session from the incoming request's cookies or
 * Authorization header. On success, populates `req.user` and `req.session`
 * and calls `next()`. On failure, responds 401.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await getSessionOnce(req);

    if (!session) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    req.user = session.user as typeof req.user;
    req.session = session.session as typeof req.session;
    next();
  } catch (error) {
    res.status(403).json({ success: false, message: "Forbidden" });
  }
};

export const requireRole = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await getSessionOnce(req);

      if (!session) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const userRole = (session.user as { role: string }).role;
      if (!roles.includes(userRole)) {
        res.status(403).json({ success: false, message: "Forbidden: Insufficient permissions" });
        return;
      }

      req.user = session.user as typeof req.user;
      req.session = session.session as typeof req.session;
      next();
    } catch {
      res.status(403).json({ success: false, message: "Forbidden" });
    }
  };
};

/**
 * Returns middleware that verifies the session AND checks that the user's
 * role is one of the accepted `roles`. Responds 403 on role mismatch.
 *
 * Usage: `router.get("/admin/users", authenticate, authorizeRoles("admin"), handler)`
 */
export const authorizeRoles = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const userRole = (req.user as { role: string }).role;
    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: requires one of [${roles.join(", ")}] role`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware that verifies moderator-level granular permissions.
 * Admins always pass; moderators are checked against the ModeratorPermission
 * table. Requires `authenticate` to have run first.
 */
export const requirePermission = (permissionKey: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const role = (req.user as { role: string }).role;
    if (role === "admin") return next();

    if (role !== "moderator") {
      res.status(403).json({
        success: false,
        message: "Forbidden: Moderator access required",
      });
      return;
    }

    const perm = await prisma.moderatorPermission.findFirst({
      where: { userId: req.user.id, permissionKey, granted: true },
    });

    if (!perm) {
      res.status(403).json({
        success: false,
        message: `Permission denied: ${permissionKey} required`,
      });
      return;
    }

    next();
  };
};

// ---- Legacy aliases (kept for backward compatibility) --------------------

export const requireAuth = authenticate;

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await getSessionOnce(req);

    if (!session) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if ((session.user as { role: string }).role !== "admin") {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    req.user = session.user as typeof req.user;
    req.session = session.session as typeof req.session;
    next();
  } catch {
    res.status(403).json({ success: false, message: "Forbidden" });
  }
};

export const requireTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await getSessionOnce(req);

    if (!session) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const role = (session.user as { role: string }).role;
    if (role !== "teacher" && role !== "admin") {
      res.status(403).json({ success: false, message: "Forbidden: Teacher access required" });
      return;
    }

    req.user = session.user as typeof req.user;
    req.session = session.session as typeof req.session;
    next();
  } catch {
    res.status(403).json({ success: false, message: "Forbidden" });
  }
};

export const requireStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await getSessionOnce(req);

    if (!session) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const role = (session.user as { role: string }).role;
    if (role !== "student" && role !== "admin") {
      res.status(403).json({ success: false, message: "Forbidden: Student access required" });
      return;
    }

    req.user = session.user as typeof req.user;
    req.session = session.session as typeof req.session;
    next();
  } catch {
    res.status(403).json({ success: false, message: "Forbidden" });
  }
};
