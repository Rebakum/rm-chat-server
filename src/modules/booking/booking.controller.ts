import { Request, Response, NextFunction } from "express";
import * as bookingService from "./booking.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const getAllBookings = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] List all", { page: req.query.page, limit: req.query.limit });
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { bookings, total } = await bookingService.findAll(page, limit);
  ApiResponse.paginated(res, bookings, total, page, limit);
});

const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] List mine", { userId: req.user!.id, role: (req.user as any).role, status: req.query.status });
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const status = req.query.status as string | undefined;
  const { bookings, total } = await bookingService.findMyBookings(
    req.user!.id,
    (req.user as any).role,
    page,
    limit,
    status
  );
  ApiResponse.paginated(res, bookings, total, page, limit);
});

const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Get details", { bookingId: req.params.id, userId: req.user!.id });
  const booking = await bookingService.findById(req.params.id as string);
  if (!booking) throw ApiError.notFound("Booking not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && booking.userId !== userId && booking.teacherId !== userId) {
    throw ApiError.forbidden("Not authorized to view this booking");
  }

  ApiResponse.success(res, booking);
});

const getBookingProgress = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Get progress", { bookingId: req.params.id, userId: req.user!.id });
  const progress = await bookingService.getProgress(req.params.id as string);
  if (!progress) throw ApiError.notFound("Booking not found");
  ApiResponse.success(res, progress);
});

const createBooking = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Create request", {
    userId: req.user!.id,
    bookingType: req.body.bookingType,
    serviceId: req.body.serviceId,
    teacherId: req.body.teacherId,
    bookingPrice: req.body.bookingPrice,
  });
  const booking = await bookingService.create(req.body, req.user!.id);
  console.log("[Booking] Created", { bookingId: booking.id, status: booking.status });
  ApiResponse.created(res, booking);
});

const studentConfirmBooking = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Student confirm request", { bookingId: req.params.id, userId: req.user!.id });
  const booking = await bookingService.findById(req.params.id as string);
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.userId !== req.user!.id) throw ApiError.forbidden("Not authorized");

  const { rating, comment } = req.body;
  const updated = await bookingService.studentConfirm(req.params.id as string, rating, comment);
  console.log("[Booking] Student confirmed", { bookingId: updated.id, status: updated.status });
  ApiResponse.success(res, updated);
});

const teacherConfirmBooking = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Teacher confirm request", { bookingId: req.params.id, userId: req.user!.id });
  const booking = await bookingService.findById(req.params.id as string);
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.teacherId !== req.user!.id) throw ApiError.forbidden("Not authorized");

  const updated = await bookingService.teacherConfirm(req.params.id as string);
  console.log("[Booking] Teacher confirmed", { bookingId: updated?.id, status: updated?.status });
  ApiResponse.success(res, updated);
});

const adminCompleteBooking = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Admin complete request", { bookingId: req.params.id, userId: req.user!.id });
  const booking = await bookingService.adminComplete(req.params.id as string);
  console.log("[Booking] Admin completed", { bookingId: booking.id, status: booking.status });
  ApiResponse.success(res, booking);
});

const acceptBooking = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Accept request", { bookingId: req.params.id, userId: req.user!.id });
  const booking = await bookingService.findById(req.params.id as string);
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.teacherId !== req.user!.id) throw ApiError.forbidden("Not authorized");

  const updated = await bookingService.acceptBooking(req.params.id as string);
  console.log("[Booking] Accepted", { bookingId: updated.id, status: updated.status });
  ApiResponse.success(res, updated);
});

const startBooking = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Booking] Start request", { bookingId: req.params.id, userId: req.user!.id });
  const booking = await bookingService.findById(req.params.id as string);
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.teacherId !== req.user!.id) throw ApiError.forbidden("Not authorized");

  const updated = await bookingService.startBooking(req.params.id as string);
  console.log("[Booking] Started", { bookingId: updated.id, status: updated.status });
  ApiResponse.success(res, updated);
});

export {
  getAllBookings,
  getMyBookings,
  getBookingById,
  getBookingProgress,
  createBooking,
  studentConfirmBooking,
  teacherConfirmBooking,
  adminCompleteBooking,
  acceptBooking,
  startBooking,
};
