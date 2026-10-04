import prisma from "../../lib/prisma";
import { CreatePaymentMethodDTO, UpdatePaymentMethodDTO } from "./paymentMethod.interface";
import ApiError from "../../utils/ApiError";

export const findByUser = async (userId: string) => {
  return prisma.userPaymentMethod.findMany({
    where: { userId },
  });
};

export const findById = async (id: string, userId: string, isAdmin: boolean = false) => {
  const method = await prisma.userPaymentMethod.findUnique({
    where: { id },
  });
  if (!method) throw ApiError.notFound("Payment method not found");
  if (!isAdmin && method.userId !== userId) {
    throw ApiError.forbidden("Not authorized to access this payment method");
  }
  return method;
};

export const create = async (userId: string, data: CreatePaymentMethodDTO) => {
  return prisma.userPaymentMethod.create({
    data: {
      userId,
      type: data.type,
      accountNumber: data.accountNumber ?? null,
      bankName: data.bankName ?? null,
      branchName: data.branchName ?? null,
      accountHolder: data.accountHolder ?? null,
      routingNumber: data.routingNumber ?? null,
    },
  });
};

export const update = async (
  id: string,
  userId: string,
  data: UpdatePaymentMethodDTO,
  isAdmin: boolean = false
) => {
  const existing = await prisma.userPaymentMethod.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Payment method not found");
  if (!isAdmin && existing.userId !== userId) {
    throw ApiError.forbidden("Not authorized to update this payment method");
  }

  return prisma.userPaymentMethod.update({
    where: { id },
    data: {
      type: data.type ?? existing.type,
      accountNumber: data.accountNumber !== undefined ? data.accountNumber : existing.accountNumber,
      bankName: data.bankName !== undefined ? data.bankName : existing.bankName,
      branchName: data.branchName !== undefined ? data.branchName : existing.branchName,
      accountHolder: data.accountHolder !== undefined ? data.accountHolder : existing.accountHolder,
      routingNumber: data.routingNumber !== undefined ? data.routingNumber : existing.routingNumber,
    },
  });
};

export const remove = async (id: string, userId: string, isAdmin: boolean = false) => {
  const existing = await prisma.userPaymentMethod.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Payment method not found");
  if (!isAdmin && existing.userId !== userId) {
    throw ApiError.forbidden("Not authorized to delete this payment method");
  }

  await prisma.userPaymentMethod.delete({ where: { id } });
  return { success: true };
};
