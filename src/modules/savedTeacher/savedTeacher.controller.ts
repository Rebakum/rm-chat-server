import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import savedTeacherService from "./savedTeacher.service";

export const saveTeacher = asyncHandler(async (req: Request, res: Response) => {
  const { teacherId } = req.body;
  const studentId = req.user!.id;

  const saved = await savedTeacherService.save(studentId, teacherId);

  ApiResponse.created(res, saved, "Teacher saved successfully");
});

export const unsaveTeacher = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.params.teacherId as string;
  const studentId = req.user!.id;

  const unsaved = await savedTeacherService.unsave(studentId, teacherId);

  ApiResponse.success(res, unsaved, "Teacher unsaved successfully");
});

export const getSavedTeachers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
  const studentId = req.user!.id;

  const { savedTeachers, total } = await savedTeacherService.findAllByStudent(studentId, { page, limit });

  ApiResponse.success(res, { savedTeachers, total });
});
