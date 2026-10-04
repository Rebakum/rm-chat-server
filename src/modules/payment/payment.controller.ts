import { Request, Response } from "express";
import * as paymentService from "./payment.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const getAllPayments = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { payments, total } = await paymentService.findAll(page, limit);
  ApiResponse.paginated(res, payments, total, page, limit);
});

const getPaymentById = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.findById(req.params.id as string);
  if (!payment) throw ApiError.notFound("Payment not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && payment.booking.userId !== userId && payment.booking.teacherId !== userId) {
    throw ApiError.forbidden("Not authorized to view this payment");
  }

  ApiResponse.success(res, payment);
});

const submitPaymentProof = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.submitProof(
    req.params.bookingId as string,
    req.body,
    req.user!.id,
  );
  ApiResponse.created(res, payment);
});

const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.confirm(req.params.paymentId as string);
  ApiResponse.success(res, payment);
});

const getMyPayments = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const userRole = (req.user as any)?.role ?? "student";
  const { payments, total } = await paymentService.findMine(req.user!.id, userRole, page, limit);
  ApiResponse.paginated(res, payments, total, page, limit);
});

export {
  getAllPayments,
  getPaymentById,
  submitPaymentProof,
  confirmPayment,
  getMyPayments,
};
