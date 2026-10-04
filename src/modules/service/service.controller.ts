import { Request, Response } from "express";
import * as serviceService from "./service.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const getAllServices = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { services, total } = await serviceService.findAll(page, limit, {
    query: String(req.query.query ?? ""),
    category: String(req.query.category ?? ""),
    engLevel: String(req.query.engLevel ?? ""),
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
  });
  ApiResponse.paginated(res, services, total, page, limit);
});

const getServiceById = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.findById(req.params.id as string);
  if (!service) throw ApiError.notFound("Service not found");
  ApiResponse.success(res, service);
});

const createService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.create(req.body, req.user!.id);
  ApiResponse.created(res, service);
});

const updateService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.findById(req.params.id as string);
  if (!service) throw ApiError.notFound("Service not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && service.teacherId !== userId) {
    throw ApiError.forbidden("Not authorized to update this service");
  }

  const updated = await serviceService.update(req.params.id as string, req.body);
  ApiResponse.success(res, updated);
});

const acceptService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.accept(req.params.id as string);
  ApiResponse.success(res, service);
});

const deleteService = asyncHandler(async (req: Request, res: Response) => {
  await serviceService.remove(req.params.id as string);
  ApiResponse.success(res, null, "Service deleted");
});

const getServicesByTeacher = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { services, total } = await serviceService.findByTeacher(req.params.teacherId as string, page, limit);
  ApiResponse.paginated(res, services, total, page, limit);
});

const getAllServicesAdmin = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { services, total } = await serviceService.findAllAdmin(page, limit);
  ApiResponse.paginated(res, services, total, page, limit);
});

export { getAllServices, getServiceById, createService, updateService, acceptService, deleteService, getServicesByTeacher, getAllServicesAdmin };
