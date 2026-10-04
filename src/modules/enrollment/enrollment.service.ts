import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { EnrollDTO } from "./enrollment.interface";
import ApiError from "../../utils/ApiError";

const enroll = async (data: EnrollDTO, userId: string) => {
  const existing = await prisma.enrollment.findFirst({ where: { userId, courseId: data.courseId } });
  if (existing) throw ApiError.conflict("Already enrolled in this course");

  return prisma.enrollment.create({
    data: {
      userId,
      courseId: data.courseId,
      courseName: data.courseName,
      name: data.name,
      country: data.country,
      address: data.address,
      whatsapp: data.whatsapp,
      paymentMethod: data.paymentMethod,
      paymentSender: data.paymentSender,
      transactionId: data.transactionId,
    },
  });
};

const getByUser = async (userId: string) => {
  return prisma.enrollment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      include: { user: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } } },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.enrollment.count(),
  ]);
  return { enrollments, total };
};

const updateStatus = async (id: string, status: string) => {
  return prisma.enrollment.update({ where: { id }, data: { status } });
};

export { enroll, getByUser, findAll, updateStatus };
