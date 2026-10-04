import { Request, Response } from "express";
import * as courseService from "./course.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.create(req.body);
  ApiResponse.created(res, course);
});

const getAllCourses = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Number(String(req.query.limit ?? 20));
  const { courses, total } = await courseService.findAll(page, limit);
  ApiResponse.paginated(res, courses, total, page, limit);
});

const getPublicCourses = asyncHandler(async (req: Request, res: Response) => {
  const courses = await courseService.findPublicCourses();
  ApiResponse.success(res, courses);
});

const getCoursesByName = asyncHandler(async (req: Request, res: Response) => {
  const courses = await courseService.findByCourseName(req.params.name as string);
  ApiResponse.success(res, courses);
});

const getCourseById = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.findById(req.params.id as string);
  if (!course) throw ApiError.notFound("Course not found");
  ApiResponse.success(res, course);
});

const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.update(req.params.id as string, req.body);
  ApiResponse.success(res, course);
});

const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  await courseService.remove(req.params.id as string);
  ApiResponse.success(res, { message: "Course deleted successfully" });
});

export { createCourse, getAllCourses, getPublicCourses, getCoursesByName, getCourseById, updateCourse, deleteCourse };
