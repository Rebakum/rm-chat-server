import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { SubmitPaymentDTO } from "./payment.interface";
import ApiError from "../../utils/ApiError";
import { notifyAdmins, notifyUser } from "../notification/notification.service";

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      include: {
        booking: {
          include: {
            student: { select: { id: true, name: true, email: true } },
            teacher: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.payment.count(),
  ]);
  return { payments, total };
};

const findById = async (id: string) =>
  prisma.payment.findUnique({ where: { id }, include: { booking: true } });

const submitProof = async (bookingIdOrCustomOrderId: string, data: SubmitPaymentDTO, userId: string) => {
  // Resolve booking — allow custom order ID to be passed in
  let booking = await prisma.booking.findUnique({ where: { id: bookingIdOrCustomOrderId } });
  if (!booking) {
    booking = await prisma.booking.findFirst({ where: { customOrderId: bookingIdOrCustomOrderId } });
  }

  // If no booking exists but a custom order does, auto-create the booking
  if (!booking) {
    const customOrder = await prisma.customOrder.findUnique({ where: { id: bookingIdOrCustomOrderId } });
    if (!customOrder) throw ApiError.notFound("Booking not found");

    booking = await prisma.booking.create({
      data: {
        bookingType: "Custom",
        customOrderId: customOrder.id,
        userId: customOrder.userId,
        teacherId: customOrder.teacherId,
        bookingPrice: customOrder.totalPrice,
        adminHoldAmount: customOrder.totalPrice,
        status: "pending",
        paymentStatus: "unpaid",
      },
    });
  }

  const bookingId = booking.id;
  if (booking.userId !== userId) throw ApiError.forbidden("Not authorized to submit payment for this booking");

  const existingPayment = await prisma.payment.findFirst({
    where: { bookingId, paymentStatus: { in: ["pending_verification", "paid"] } },
  });
  if (existingPayment) throw ApiError.conflict("A pending or paid payment already exists for this booking");

  const payment = await prisma.payment.create({
    data: {
      ...data,
      bookingId,
      bookingPrice: booking.bookingPrice,
      paymentStatus: "pending_verification",
      paymentVerified: false,
    },
  });
  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: "pending" },
  });

  const student = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } });
  await notifyAdmins(
    "payment_submitted",
    `${student?.displayName || student?.name || "A student"} submitted a payment awaiting verification.`,
    { bookingId, paymentId: payment.id },
  );

  return payment;
};

const confirm = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw ApiError.notFound("Payment not found");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { paymentStatus: "paid", paymentVerified: true },
    });

    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { paymentStatus: "paid" },
    });

    return tx.payment.findUnique({ where: { id: paymentId } });
  });

  const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId }, select: { userId: true } });
  if (booking) {
    await notifyUser(booking.userId, "payment_verified", "Your payment has been verified.", { bookingId: payment.bookingId, paymentId });
  }

  return updated;
};

const findMine = async (userId: string, role: string, page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const where = role === "teacher"
    ? { booking: { teacherId: userId } }
    : { booking: { userId } };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            student: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } },
            teacher: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } },
            service: { select: { id: true, title: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
  ]);
  return { payments, total };
};

export { findAll, findById, submitProof, confirm, findMine };
