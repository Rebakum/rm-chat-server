import { Request, Response } from "express";
import * as freeClassBookingService from "./freeClassBooking.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

export const bookFreeClass = asyncHandler(async (req: Request, res: Response) => {
  const booking = await freeClassBookingService.book(req.body, req.user!.id);
  ApiResponse.created(res, booking);
});

export const getAllFreeClassBookings = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? "1"));
  const limit = Math.min(Number(String(req.query.limit ?? "20")), 100);
  const { bookings, total } = await freeClassBookingService.findAll(page, limit);
  ApiResponse.paginated(res, bookings, total, page, limit);
});

export const updateFreeClassStatus = asyncHandler(async (req: Request, res: Response) => {
  const booking = await freeClassBookingService.updateStatus(
    req.params.id as string,
    req.body.status,
    req.body.adminNote,
  );
  ApiResponse.success(res, booking);
});
