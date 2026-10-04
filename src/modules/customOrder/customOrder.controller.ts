import { Request, Response } from "express";
import * as customOrderService from "./customOrder.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const getAllCustomOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { orders, total } = await customOrderService.findAll(page, limit);
  ApiResponse.paginated(res, orders, total, page, limit);
});

const getCustomOrderById = asyncHandler(async (req: Request, res: Response) => {
  const order = await customOrderService.findById(req.params.id as string);
  if (!order) throw ApiError.notFound("Custom order not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && order.userId !== userId && order.teacherId !== userId) {
    throw ApiError.forbidden("Not authorized to view this custom order");
  }

  ApiResponse.success(res, order);
});

const createCustomOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await customOrderService.create(req.body, req.user!.id);
  ApiResponse.created(res, order);
});

const updateCustomOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await customOrderService.findById(req.params.id as string);
  if (!order) throw ApiError.notFound("Custom order not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && order.userId !== userId && order.teacherId !== userId) {
    throw ApiError.forbidden("Not authorized to update this custom order");
  }

  const updated = await customOrderService.updateStatus(req.params.id as string, req.body.status);
  ApiResponse.success(res, updated);
});

const getMyCustomOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { orders, total } = await customOrderService.findMyOrders(req.user!.id, page, limit);
  ApiResponse.paginated(res, orders, total, page, limit);
});

export {
  getAllCustomOrders,
  getCustomOrderById,
  createCustomOrder,
  updateCustomOrderStatus,
  getMyCustomOrders,
};
