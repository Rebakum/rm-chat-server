import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { Payout, Prisma } from "@prisma/client";
import ApiError from "../../utils/ApiError";

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      include: { teacher: { select: { id: true, name: true, email: true, photoURL: true } } },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
    prisma.payout.count(),
  ]);
  return { payouts, total };
};

const findById = async (id: string) =>
  prisma.payout.findUnique({ where: { id }, include: { teacher: true } });

const findByTeacher = async (teacherId: string) =>
  prisma.payout.findMany({ where: { teacherId }, orderBy: { date: "desc" } });

const request = async (teacherId: string, amountRequested: number, method: string) => {
  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacher) throw ApiError.notFound("Teacher not found");
  if (teacher.balance < amountRequested) throw ApiError.badRequest("Insufficient balance");

  const pendingPayout = await prisma.payout.findFirst({
    where: { teacherId, status: "pending" },
  });
  if (pendingPayout) throw ApiError.conflict("A pending payout request already exists");

  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.create({
      data: { teacherId, amountRequested, amountPaid: 0, method, status: "pending" },
    });

    await tx.user.update({
      where: { id: teacherId },
      data: { balance: { decrement: amountRequested } },
    });

    return payout;
  });
};

const markPaid = async (id: string, amountPaid: number): Promise<Payout> => {
  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout) throw ApiError.notFound("Payout not found");
  if (payout.status === "paid") throw ApiError.conflict("Payout already marked as paid");

  return prisma.payout.update({
    where: { id },
    data: { amountPaid, status: "paid", paidAt: new Date() },
  });
};

export { findAll, findById, findByTeacher, request, markPaid };
