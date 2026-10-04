import { Request, Response } from "express";
import * as paymentMethodService from "./paymentMethod.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

export const getMyPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  const methods = await paymentMethodService.findByUser(req.user!.id);
  ApiResponse.success(res, methods);
});

export const getPaymentMethodById = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin = (req.user as any)?.role === "admin";
  const method = await paymentMethodService.findById(req.params.id as string, req.user!.id, isAdmin);
  ApiResponse.success(res, method);
});

export const createPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const method = await paymentMethodService.create(req.user!.id, req.body);
  ApiResponse.created(res, method);
});

export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin = (req.user as any)?.role === "admin";
  const method = await paymentMethodService.update(req.params.id as string, req.user!.id, req.body, isAdmin);
  ApiResponse.success(res, method);
});

export const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin = (req.user as any)?.role === "admin";
  const result = await paymentMethodService.remove(req.params.id as string, req.user!.id, isAdmin);
  ApiResponse.success(res, result);
});
