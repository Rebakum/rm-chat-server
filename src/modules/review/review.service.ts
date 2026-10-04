import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { SubmitReviewDTO } from "./review.interface";
import ApiError from "../../utils/ApiError";

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      include: {
        user: { select: { id: true, name: true, displayName: true, photoURL: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.review.count(),
  ]);
  return { reviews, total };
};

const create = async (data: SubmitReviewDTO, userId: string) => {
  const existing = await prisma.review.findFirst({ where: { userId } });
  if (existing) throw ApiError.conflict("You have already submitted a review");

  return prisma.review.create({
    data: {
      userId,
      name: data.name,
      email: data.email,
      role: data.role,
      photoURL: data.photoURL,
      presentCountry: data.presentCountry,
      rating: data.rating,
      description: data.description,
    },
  });
};

const remove = async (id: string) => prisma.review.delete({ where: { id } });

export { findAll, create, remove };
