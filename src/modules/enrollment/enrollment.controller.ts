import { Request, Response } from "express";
import * as enrollmentService from "./enrollment.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const enroll = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await enrollmentService.enroll(req.body, req.user!.id);
  ApiResponse.created(res, enrollment);
});

const getUserEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  if (req.user!.id !== userId && (req.user as any).role !== "admin") {
    throw ApiError.forbidden("Not authorized to view these enrollments");
  }
  const enrollments = await enrollmentService.getByUser(userId);
  ApiResponse.success(res, enrollments);
});

const getAllEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { enrollments, total } = await enrollmentService.findAll(page, limit);
  ApiResponse.paginated(res, enrollments, total, page, limit);
});

const updateEnrollmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await enrollmentService.updateStatus(req.params.id as string, req.body.status);
  ApiResponse.success(res, enrollment);
});

const getMyEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const enrollments = await enrollmentService.getByUser(req.user!.id);
  ApiResponse.success(res, enrollments);
});

export { enroll, getUserEnrollments, getMyEnrollments, getAllEnrollments, updateEnrollmentStatus };
