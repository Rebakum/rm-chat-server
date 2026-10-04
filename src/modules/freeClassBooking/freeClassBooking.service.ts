import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { BookFreeClassDTO, FreeClassBookingWithUser } from "./freeClassBooking.interface";
import ApiError from "../../utils/ApiError";

export const book = async (data: BookFreeClassDTO, userId?: string) => {
  const existing = await prisma.freeClassBooking.findUnique({ where: { email: data.email } });
  if (existing) throw ApiError.conflict("A free class booking already exists for this email");

  return prisma.freeClassBooking.create({
    data: {
      name: data.name,
      email: data.email,
      courseName: data.courseName,
      sourcePage: data.sourcePage,
      sourceUrl: data.sourceUrl,
      sourceTitle: data.sourceTitle,
      referrer: data.referrer,
      userId: userId || null,
      isRegisteredUser: !!userId,
    },
  });
};

export const findAll = async (page = 1, limit = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [bookings, total] = await Promise.all([
    prisma.freeClassBooking.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.freeClassBooking.count(),
  ]);
  return { bookings: bookings as FreeClassBookingWithUser[], total };
};

export const updateStatus = async (id: string, status: string, adminNote?: string) => {
  return prisma.freeClassBooking.update({
    where: { id },
    data: {
      status,
      ...(adminNote !== undefined && { adminNote }),
    },
  });
};
