import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { CreateDawraDTO, AddMonthlyFeeDTO, DawraWithRelations, DawraMonthlyFee } from "./dawra.interface";

export const findAll = async (page = 1, limit = 20): Promise<{ dawras: DawraWithRelations[]; total: number }> => {
  const { skip, take } = paginate({}, page, limit);
  const [dawras, total] = await Promise.all([
    prisma.dawra.findMany({
      include: {
        user: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } },
        monthlyFees: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.dawra.count(),
  ]);
  return { dawras, total };
};

export const findById = async (id: string): Promise<DawraWithRelations | null> => {
  return prisma.dawra.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } },
      monthlyFees: true,
    },
  }) as unknown as Promise<DawraWithRelations | null>;
};

export const create = async (data: CreateDawraDTO, userId: string) => {
  return prisma.dawra.create({
    data: {
      userId,
      email: data.email,
      displayName: data.displayName,
      birthCertificateUrl: data.birthCertificateUrl,
      fatherName: data.fatherName,
      fatherPhone: data.fatherPhone,
      currentStudy: data.currentStudy,
      phone: data.phone,
    },
  });
};

export const update = async (id: string, data: Partial<CreateDawraDTO>) => {
  return prisma.dawra.update({ where: { id }, data });
};

export const addMonthlyFee = async (dawraId: string, data: AddMonthlyFeeDTO): Promise<DawraMonthlyFee> => {
  const fee = await prisma.dawraMonthlyFee.create({
    data: {
      dawraId,
      month: data.month,
      amount: data.amount,
      paid: data.paid || false,
      transactionId: data.transactionId,
      paymentMethod: data.paymentMethod,
      paymentPhone: data.paymentPhone,
    },
  });

  const totalFees = await prisma.dawraMonthlyFee.aggregate({
    where: { dawraId },
    _sum: { amount: true },
  });

  await prisma.dawra.update({
    where: { id: dawraId },
    data: { totalFees: totalFees._sum.amount || 0 },
  });

  return fee as unknown as Promise<DawraMonthlyFee>;
};
