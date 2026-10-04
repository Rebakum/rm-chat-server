import { Request, Response } from "express";
import * as dawraService from "./dawra.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

export const getAllDawras = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { dawras, total } = await dawraService.findAll(page, limit);
  ApiResponse.paginated(res, dawras, total, page, limit);
});

export const getDawraById = asyncHandler(async (req: Request, res: Response) => {
  const dawra = await dawraService.findById(req.params.id as string);
  if (!dawra) throw ApiError.notFound("Dawra not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && dawra.userId !== userId) {
    throw ApiError.forbidden("Not authorized to view this dawra");
  }

  ApiResponse.success(res, dawra);
});

export const createDawra = asyncHandler(async (req: Request, res: Response) => {
  const dawra = await dawraService.create(req.body, req.user!.id);
  ApiResponse.created(res, dawra);
});

export const updateDawra = asyncHandler(async (req: Request, res: Response) => {
  const dawra = await dawraService.findById(req.params.id as string);
  if (!dawra) throw ApiError.notFound("Dawra not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && dawra.userId !== userId) {
    throw ApiError.forbidden("Not authorized to update this dawra");
  }

  const updated = await dawraService.update(req.params.id as string, req.body);
  ApiResponse.success(res, updated);
});

export const addMonthlyFee = asyncHandler(async (req: Request, res: Response) => {
  const dawra = await dawraService.findById(req.params.id as string);
  if (!dawra) throw ApiError.notFound("Dawra not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && dawra.userId !== userId) {
    throw ApiError.forbidden("Not authorized to add fees to this dawra");
  }

  const fee = await dawraService.addMonthlyFee(req.params.id as string, req.body);
  ApiResponse.created(res, fee);
});
