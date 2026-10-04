import { Request, Response } from "express";
import * as reviewService from "./review.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Number(String(req.query.limit ?? 20));
  const { reviews, total } = await reviewService.findAll(page, limit);
  ApiResponse.paginated(res, reviews, total, page, limit);
});

const submitReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.create(req.body, req.user!.id);
  ApiResponse.created(res, review);
});

const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await reviewService.remove(req.params.id as string);
  ApiResponse.success(res, null, "Review deleted");
});

export { getAllReviews, submitReview, deleteReview };
