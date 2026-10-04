import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { CreateServiceDTO } from "./service.interface";
import { Prisma } from "@prisma/client";

interface ServiceFilters {
  query?: string;
  category?: string;
  engLevel?: string;
  minPrice?: number;
  maxPrice?: number;
}

const findAll = async (page: number = 1, limit: number = 20, filters: ServiceFilters = {}) => {
  const { skip, take } = paginate({}, page, limit);
  const where: Prisma.ServiceWhereInput = {};
  if (filters.query) {
    where.OR = [
      { title: { contains: filters.query, mode: "insensitive" } },
      { description: { contains: filters.query, mode: "insensitive" } },
      { category: { contains: filters.query, mode: "insensitive" } },
    ];
  }
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
  if (filters.engLevel) where.engLevel = { contains: filters.engLevel, mode: "insensitive" };
  if (Number.isFinite(filters.minPrice) || Number.isFinite(filters.maxPrice)) {
    where.price = { ...(Number.isFinite(filters.minPrice) ? { gte: filters.minPrice } : {}), ...(Number.isFinite(filters.maxPrice) ? { lte: filters.maxPrice } : {}) };
  }
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, displayName: true, photoURL: true, presentCountry: true, category: true } },
        faqs: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.service.count({ where }),
  ]);
  return { services, total };
};

const findById = async (id: string) => {
  return prisma.service.findUnique({
    where: { id },
    include: { teacher: true, faqs: true },
  });
};

const create = async (data: CreateServiceDTO, teacherId: string) => {
  const { faqs, ...serviceData } = data;
  return prisma.service.create({
    data: {
      ...serviceData,
      teacherId,
      status: "Pending",
      faqs: faqs ? { create: faqs } : undefined,
    },
    include: { faqs: true },
  });
};

const update = async (id: string, data: Partial<CreateServiceDTO>) => {
  const { faqs, ...serviceData } = data;
  return prisma.service.update({ where: { id }, data: serviceData, include: { faqs: true } });
};

const accept = async (id: string) => {
  return prisma.service.update({ where: { id }, data: { status: "Accepted" } });
};

const remove = async (id: string) => prisma.service.delete({ where: { id } });

const findByTeacher = async (teacherId: string, page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where: { teacherId },
      include: {
        teacher: { select: { id: true, name: true, displayName: true, photoURL: true, email: true } },
        faqs: true,
      },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.service.count({ where: { teacherId } }),
  ]);
  return { services, total };
};

const findAllAdmin = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      include: {
        teacher: { select: { id: true, name: true, displayName: true, photoURL: true, email: true } },
        faqs: true,
      },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.service.count(),
  ]);
  return { services, total };
};

export { findAll, findById, create, update, accept, remove, findByTeacher, findAllAdmin };
