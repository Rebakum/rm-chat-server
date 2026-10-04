import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { CreateJobDTO } from "./job.interface";
import ApiError from "../../utils/ApiError";
import { Prisma } from "@prisma/client";

interface JobFilters { query?: string; category?: string; teacherType?: string; genderPreference?: string; minSalary?: number; maxSalary?: number; }

const findAll = async (page: number = 1, limit: number = 20, filters: JobFilters = {}) => {
  const { skip, take } = paginate({}, page, limit);
  const where: Prisma.JobWhereInput = { jobStatus: "Open" };
  if (filters.query) {
    where.OR = [
      { jobTitle: { contains: filters.query, mode: "insensitive" } },
      { jobDescription: { contains: filters.query, mode: "insensitive" } },
      { category: { contains: filters.query, mode: "insensitive" } },
      { teacherType: { contains: filters.query, mode: "insensitive" } },
      { qualifications: { contains: filters.query, mode: "insensitive" } },
    ];
  }
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
  if (filters.teacherType) where.teacherType = { contains: filters.teacherType, mode: "insensitive" };
  if (filters.genderPreference) where.genderPreference = { contains: filters.genderPreference, mode: "insensitive" };
  if (Number.isFinite(filters.minSalary) || Number.isFinite(filters.maxSalary)) {
    where.maxSalary = { ...(Number.isFinite(filters.minSalary) ? { gte: filters.minSalary } : {}), ...(Number.isFinite(filters.maxSalary) ? { lte: filters.maxSalary } : {}) };
  }
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        poster: { select: { id: true, name: true, displayName: true, photoURL: true } },
        applications: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.job.count({ where }),
  ]);
  return { jobs, total };
};

const findById = async (id: string) => {
  return prisma.job.findUnique({
    where: { id },
    include: {
      poster: true,
      applications: {
        include: {
          applicant: { select: { id: true, name: true, displayName: true, photoURL: true } },
        },
      },
    },
  });
};

const create = async (data: CreateJobDTO, userId: string) => {
  return prisma.job.create({
    data: { ...data, userId, status: "Pending", jobStatus: "Open" },
  });
};

const apply = async (jobId: string, teacherId: string, message?: string) => {
  const existing = await prisma.jobApplication.findFirst({ where: { jobId, teacherId } });
  if (existing) throw ApiError.conflict("Already applied to this job");
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { name: true, displayName: true },
  });
  return prisma.jobApplication.create({
    data: { jobId, teacherId, teacherName: teacher?.name || teacher?.displayName, message },
  });
};

const updateStatus = async (jobId: string, jobStatus: string) => {
  return prisma.job.update({ where: { id: jobId }, data: { jobStatus } });
};

const findMyJobs = async (userId: string, page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where: { userId },
      include: {
        poster: { select: { id: true, name: true, displayName: true, photoURL: true } },
        applications: true,
      },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.job.count({ where: { userId } }),
  ]);
  return { jobs, total };
};

const findTeacherApplications = async (teacherId: string, page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [applications, total] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { teacherId },
      include: {
        job: {
          include: {
            poster: { select: { id: true, name: true, displayName: true, photoURL: true } },
          },
        },
      },
      orderBy: { appliedAt: "desc" },
      skip, take,
    }),
    prisma.jobApplication.count({ where: { teacherId } }),
  ]);
  return { applications, total };
};

export { findAll, findById, create, apply, updateStatus, findMyJobs, findTeacherApplications };
