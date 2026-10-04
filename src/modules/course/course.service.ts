import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { CreateCourseDTO } from "./course.interface";

const create = async (data: CreateCourseDTO) => {
  return prisma.course.upsert({
    where: { email_courseName: { email: data.email, courseName: data.courseName } },
    update: {},
    create: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      gender: data.gender,
      terms: data.terms || true,
      courseName: data.courseName,
    },
  });
};

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [courses, total] = await Promise.all([
    prisma.course.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.course.count(),
  ]);
  return { courses, total };
};

const findPublicCourses = async () => {
  const courseNames = await prisma.course.findMany({
    select: { courseName: true },
    distinct: ["courseName"],
    orderBy: { courseName: "asc" },
  });
  return courseNames.map((c) => c.courseName);
};

const findByCourseName = async (courseName: string) => {
  return prisma.course.findMany({
    where: { courseName },
    orderBy: { createdAt: "desc" },
  });
};

const findById = async (id: string) => {
  return prisma.course.findUnique({ where: { id } });
};

const update = async (id: string, data: Partial<CreateCourseDTO>) => {
  return prisma.course.update({
    where: { id },
    data,
  });
};

const remove = async (id: string) => {
  return prisma.course.delete({
    where: { id },
  });
};

export { create, findAll, findPublicCourses, findByCourseName, findById, update, remove };
