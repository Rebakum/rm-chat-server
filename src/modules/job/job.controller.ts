import { Request, Response } from "express";
import * as jobService from "./job.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const getAllJobs = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { jobs, total } = await jobService.findAll(page, limit, {
    query: String(req.query.query ?? ""),
    category: String(req.query.category ?? ""),
    teacherType: String(req.query.teacherType ?? ""),
    genderPreference: String(req.query.genderPreference ?? ""),
    minSalary: req.query.minSalary ? Number(req.query.minSalary) : undefined,
    maxSalary: req.query.maxSalary ? Number(req.query.maxSalary) : undefined,
  });
  ApiResponse.paginated(res, jobs, total, page, limit);
});

const getJobById = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.findById(req.params.id as string);
  if (!job) throw ApiError.notFound("Job not found");
  ApiResponse.success(res, job);
});

const createJob = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.create(req.body, req.user!.id);
  ApiResponse.created(res, job);
});

const applyToJob = asyncHandler(async (req: Request, res: Response) => {
  const application = await jobService.apply(req.params.jobId as string, req.user!.id, req.body.message);
  ApiResponse.created(res, application);
});

const updateJobStatus = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.findById(req.params.jobId as string);
  if (!job) throw ApiError.notFound("Job not found");

  const userId = req.user!.id;
  const userRole = (req.user as any).role;
  if (userRole !== "admin" && job.userId !== userId) {
    throw ApiError.forbidden("Not authorized to update this job status");
  }

  const updated = await jobService.updateStatus(req.params.jobId as string, req.body.jobStatus);
  ApiResponse.success(res, updated);
});

const getMyJobs = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { jobs, total } = await jobService.findMyJobs(req.user!.id, page, limit);
  ApiResponse.paginated(res, jobs, total, page, limit);
});

const getTeacherApplications = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { applications, total } = await jobService.findTeacherApplications(req.user!.id, page, limit);
  ApiResponse.paginated(res, applications, total, page, limit);
});

export { getAllJobs, getJobById, createJob, applyToJob, updateJobStatus, getMyJobs, getTeacherApplications };
