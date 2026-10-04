import { Request, Response } from "express";
import * as userService from "./user.service";
import { sendWelcomeEmail } from "../../lib/mailer";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";
import { Prisma } from "@prisma/client";
import { disconnectUserSockets, emitToAdmins, emitToAll } from "../../sockets";

const PROFILE_UPDATE_FIELDS = [
  "name",
  "firstname",
  "lastname",
  "username",
  "displayName",
  "birthdate",
  "gender",
  "phone",
  "whatsapp",
  "presentAddress",
  "presentCountry",
  "permanentAddress",
  "permanentCountry",
  "bio",
  "jobTitle",
  "teacherType",
  "category",
  "englishLevel",
  "facebook",
  "linkedin",
  "instagram",
  "twitter",
  "youtubeLink",
  "cvUrl",
  "nid",
  "nidOrPassportUrl",
  "photoURL",
  "coverImage",
  "coverImageOriginal",
  "coverCrop",
  "liveCameraPhoto",
  "minRate",
  "maxRate",
] as const;

const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { users, total } = await userService.findAll(page, limit);
  ApiResponse.paginated(res, users, total, page, limit);
});

const getUserById = asyncHandler(async (req: Request, res: Response) => {
  // ?full=1 opts into the seven relation selects (skills, education,
  // experience, gallery, FAQs, certificates, teaching languages) — only the
  // profile-editing pages need those. Everything else (auth/session
  // restore, chat headers, etc.) gets the lean, much faster response by
  // default. See user.service.ts's findById for the measured impact.
  const full = req.query.full === "1" || req.query.full === "true";
  const user = await userService.findById(
    req.params.id as string,
    req.user!.id,
    (req.user as any).role,
    full,
  );
  if (!user) throw ApiError.notFound("User not found");
  ApiResponse.success(res, user);
});

const updateUserField = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  if (req.user!.id !== userId && (req.user as any).role !== "admin") {
    throw ApiError.forbidden("Not authorized to update this user");
  }
  const { role: _role, status: _status, galleryImages, teachingLanguages, skills, education, experience, faqs, certificates, ...profileFields } = req.body;
  void _role;
  void _status;
  const profileData = Object.fromEntries(
    PROFILE_UPDATE_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(profileFields, field))
      .map((field) => [field, profileFields[field]]),
  );
   const data = profileData as Prisma.UserUpdateInput;
  // Nullable Json columns reject plain `null` — map it to an explicit DB NULL.
  if ("coverCrop" in profileData && profileData.coverCrop === null) {
    data.coverCrop = Prisma.DbNull;
  }
  const replaceRelation = (relation: "teachingLanguages" | "skills" | "education" | "experience" | "faqs" | "certificates", rows: unknown[]) => {
    const create = rows.map((row) => {
      if (typeof row !== "string") return row;
      if (relation === "teachingLanguages") return { lang: row };
      if (relation === "skills") return { skill: row };
      if (relation === "certificates") return { url: row };
      if (relation === "education") return { degree: row };
      if (relation === "experience") return { title: row };
      const [question, answer = ""] = row.split(":");
      return { question: question.trim(), answer: answer.trim() };
    });
    (data as Record<string, unknown>)[relation] = { deleteMany: {}, create };
  };
  if (Array.isArray(galleryImages)) {
    data.galleryImages = {
      deleteMany: {},
      create: galleryImages.map((url: string) => ({ url })),
    };
  }
  if (Array.isArray(teachingLanguages)) replaceRelation("teachingLanguages", teachingLanguages);
  if (Array.isArray(skills)) replaceRelation("skills", skills);
  if (Array.isArray(education)) replaceRelation("education", education);
  if (Array.isArray(experience)) replaceRelation("experience", experience);
  if (Array.isArray(faqs)) replaceRelation("faqs", faqs);
  if (Array.isArray(certificates)) replaceRelation("certificates", certificates);
  const user = await userService.updateById(userId, data);
  ApiResponse.success(res, user);
});

const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  const { user, changed } = await userService.updateStatus(
    userId,
    req.body.status,
    req.user!.id,
  );
  if (user.status === "rejected" || user.status === "banned") {
    disconnectUserSockets(userId);
  }
  emitToAll("account_status_changed", {
    userId,
    status: user.status,
  });
  if (changed) {
    const displayName = user.displayName || user.name || user.email;
    emitToAdmins("admin:notification", {
      action: user.status === "accepted" ? "USER_ACCEPTED" : "USER_REJECTED",
      targetId: userId,
      detail: `${displayName}'s access was ${user.status}.`,
      createdAt: new Date().toISOString(),
    });
  }
  ApiResponse.success(res, user);
});

const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.remove(req.params.id as string);
  ApiResponse.success(res, null, "User deleted");
});

const getOnlineUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await userService.getOnlineUsers();
  ApiResponse.success(res, users);
});

const getOnlineTeachers = asyncHandler(async (req: Request, res: Response) => {
  const teachers = await userService.getOnlineTeachers();
  ApiResponse.success(res, teachers);
});

const getEligibleTeachers = asyncHandler(async (req: Request, res: Response) => {
  const teachers = await userService.getEligibleTeachers();
  ApiResponse.success(res, teachers);
});

const getEligibleTeacherById = asyncHandler(async (req: Request, res: Response) => {
  const teacher = await userService.getEligibleTeacherById(req.params.id as string);
  if (!teacher) throw ApiError.notFound("Teacher not found");
  ApiResponse.success(res, teacher);
});

const getTeacherDashboard = asyncHandler(async (req: Request, res: Response) => {
  const dashboard = await userService.getTeacherDashboard(req.user!.id);
  if (!dashboard) throw ApiError.notFound("Teacher not found");
  ApiResponse.success(res, dashboard);
});

const getVerifiedStudents = asyncHandler(async (req: Request, res: Response) => {
  const students = await userService.getVerifiedStudents();
  ApiResponse.success(res, students);
});

const sendWelcome = asyncHandler(async (req: Request, res: Response) => {
  const { email, name } = req.body;
  await sendWelcomeEmail(email, name);
  ApiResponse.success(res, null, "Welcome email sent");
});

export {
  getAllUsers, getUserById,
  updateUserField, updateUserStatus, deleteUser, getOnlineUsers,
  getOnlineTeachers, getEligibleTeachers, getEligibleTeacherById, getVerifiedStudents, sendWelcome,
  getTeacherDashboard,
};
