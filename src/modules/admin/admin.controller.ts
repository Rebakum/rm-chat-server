import { Request, Response } from "express";
import * as adminService from "./admin.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";
import prisma from "../../lib/prisma";
import auth from "../../lib/auth";

const getAllTeachers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Number(String(req.query.limit ?? 20));
  const { teachers, total } = await adminService.getAllTeachers(page, limit);
  ApiResponse.paginated(res, teachers, total, page, limit);
});

const getTeacherById = asyncHandler(async (req: Request, res: Response) => {
  const teacher = await adminService.getTeacherById(req.params.teacherId as string);
  if (!teacher) throw ApiError.notFound("Teacher not found");
  ApiResponse.success(res, teacher);
});

const updateTeacherStatus = asyncHandler(async (req: Request, res: Response) => {
  const teacher = await adminService.updateTeacherStatus(req.params.teacherId as string, req.body.status);
  ApiResponse.success(res, teacher);
});

const updateTeacherPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const teacher = await adminService.updateTeacherPaymentStatus(req.params.teacherId as string, req.body.paymentStatus);
  ApiResponse.success(res, teacher);
});

const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(String(req.query.page ?? 1)) || 1);
  const limit = Math.min(100, Math.max(1, Number(String(req.query.limit ?? 20)) || 20));
  const { users, total } = await adminService.getAllUsers(page, limit, {
    role: String(req.query.role ?? ""),
    status: String(req.query.status ?? ""),
    search: String(req.query.search ?? "").trim(),
    sort: String(req.query.sort ?? ""),
  });
  ApiResponse.paginated(res, users, total, page, limit);
});

const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  ApiResponse.success(res, stats);
});

const getDashboardOverview = asyncHandler(async (req: Request, res: Response) => {
  const overview = await adminService.getDashboardOverview();
  ApiResponse.success(res, overview);
});

const getSidebarBadges = asyncHandler(async (req: Request, res: Response) => {
  const badges = await adminService.getSidebarBadges();
  ApiResponse.success(res, badges);
});

const getRegistryAudit = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(String(req.query.page ?? 1)) || 1);
  const limit = Math.min(100, Math.max(1, Number(String(req.query.limit ?? 20)) || 20));
  const emptyFieldsRaw = String(req.query.emptyFields ?? "");
  const { items, total } = await adminService.getRegistryAudit({
    role: String(req.query.role ?? "student"),
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
    emptyFields: emptyFieldsRaw ? emptyFieldsRaw.split(",") : [],
    unverifiedOnly: req.query.unverifiedOnly === "1" || req.query.unverifiedOnly === "true",
    page,
    limit,
  });
  ApiResponse.paginated(res, items, total, page, limit);
});

const forceVerifyUser = asyncHandler(async (req: Request, res: Response) => {
  const verified = req.body?.verified !== false;
  const user = await adminService.forceVerifyEmail(req.params.id as string, verified);
  ApiResponse.success(res, user, verified ? "User marked as verified" : "User verification revoked");
});

const sendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id as string }, select: { email: true, name: true, emailVerified: true } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.emailVerified) throw ApiError.badRequest("This user is already verified");
  await auth.api.sendVerificationOTP({ body: { email: user.email, type: "email-verification" } });
  ApiResponse.success(res, null, "Verification email sent");
});

export { getAllTeachers, getTeacherById, updateTeacherStatus, updateTeacherPaymentStatus, getAllUsers, getDashboardStats, getDashboardOverview, getSidebarBadges, getRegistryAudit, forceVerifyUser, sendVerificationEmail };
