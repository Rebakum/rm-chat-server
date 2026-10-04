import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { CreateCustomOrderDTO } from "./customOrder.interface";

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [orders, total] = await Promise.all([
    prisma.customOrder.findMany({
      include: { bookings: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.customOrder.count(),
  ]);
  return { orders, total };
};

const findById = async (id: string) =>
  prisma.customOrder.findUnique({
    where: { id },
    include: { bookings: true },
  });

const create = async (data: CreateCustomOrderDTO, userId: string) => {
  const order = await prisma.customOrder.create({
    data: {
      ...data,
      userId,
      status: "Pending",
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });

  // Auto-create a linked booking so it displays in bookings and allows payment
  await prisma.booking.create({
    data: {
      bookingType: "Custom",
      customOrderId: order.id,
      userId: order.userId,
      teacherId: order.teacherId,
      bookingPrice: order.totalPrice,
      adminHoldAmount: order.totalPrice,
      status: "pending",
      paymentStatus: "unpaid",
    },
  });

  return order;
};

const updateStatus = async (id: string, status: string) =>
  prisma.customOrder.update({ where: { id }, data: { status } });

const findMyOrders = async (userId: string, page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const where = { OR: [{ userId }, { teacherId: userId }] };
  const [orders, total] = await Promise.all([
    prisma.customOrder.findMany({
      where,
      include: { bookings: true },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.customOrder.count({ where }),
  ]);
  return { orders, total };
};

export { findAll, findById, create, updateStatus, findMyOrders };
