import { Request, Response } from "express";
import * as payoutService from "./payout.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const getAllPayouts = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { payouts, total } = await payoutService.findAll(page, limit);
  ApiResponse.paginated(res, payouts, total, page, limit);
});

const getPayoutById = asyncHandler(async (req: Request, res: Response) => {
  const payout = await payoutService.findById(req.params.id as string);
  if (!payout) throw ApiError.notFound("Payout not found");
  ApiResponse.success(res, payout);
});

const getTeacherPayouts = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.params.teacherId as string;
  if (req.user!.id !== teacherId && (req.user as any).role !== "admin") {
    throw ApiError.forbidden("Not authorized to view these payouts");
  }
  const payouts = await payoutService.findByTeacher(teacherId);
  ApiResponse.success(res, payouts);
});

const requestPayout = asyncHandler(async (req: Request, res: Response) => {
  const payout = await payoutService.request(
    req.user!.id,
    req.body.amountRequested,
    req.body.method,
  );
  ApiResponse.created(res, payout);
});

const markPayoutPaid = asyncHandler(async (req: Request, res: Response) => {
  const payout = await payoutService.markPaid(req.params.id as string, req.body.amountPaid);
  ApiResponse.success(res, payout);
});

export { getAllPayouts, getPayoutById, getTeacherPayouts, requestPayout, markPayoutPaid };
