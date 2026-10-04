import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import * as teacherApplicationService from "./teacherApplication.service";

const createApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await teacherApplicationService.create(req.user!.id, req.body);
  ApiResponse.created(res, application, "Teacher application submitted for review");
});

const getMyApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await teacherApplicationService.getMine(req.user!.id);
  ApiResponse.success(res, application);
});

const listApplications = asyncHandler(async (req: Request, res: Response) => {
  const applications = await teacherApplicationService.listForAdmin(req.query.status as string | undefined);
  ApiResponse.success(res, applications);
});

const reviewApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await teacherApplicationService.review(
    req.params.id as string,
    req.user!.id,
    req.body.status,
  );
  ApiResponse.success(res, application, `Application ${req.body.status}`);
});

export { createApplication, getMyApplication, listApplications, reviewApplication };
