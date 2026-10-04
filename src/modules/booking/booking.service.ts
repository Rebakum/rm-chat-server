import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { CreateBookingDTO } from "./booking.interface";
import ApiError from "../../utils/ApiError";
import { notifyUser } from "../notification/notification.service";

const displayNameOf = (user: { name: string | null; displayName: string | null } | null) =>
  user?.displayName || user?.name || "Someone";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["waiting_for_confirmation", "cancelled"],
  waiting_for_confirmation: ["completed"],
  completed: [],
  cancelled: [],
};

const validateTransition = (currentStatus: string, newStatus: string): void => {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw ApiError.badRequest(
      `Cannot transition from "${currentStatus}" to "${newStatus}"`
    );
  }
};

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      include: {
        student: { select: { id: true, name: true, displayName: true, photoURL: true, email: true } },
        teacher: { select: { id: true, name: true, displayName: true, photoURL: true, email: true } },
        service: true,
      },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.booking.count(),
  ]);
  return { bookings, total };
};

const findMyBookings = async (
  userId: string,
  role: string,
  page: number = 1,
  limit: number = 20,
  status?: string
) => {
  const { skip, take } = paginate({}, page, limit);

  const where: Record<string, unknown> =
    role === "teacher"
      ? { teacherId: userId }
      : { userId };

  if (status) where.status = status;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, displayName: true, photoURL: true } },
        teacher: { select: { id: true, name: true, displayName: true, photoURL: true } },
        service: { select: { id: true, title: true, price: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total };
};

const findById = async (id: string) => {
  return prisma.booking.findUnique({
    where: { id },
    include: { student: true, teacher: true, service: true, customOrder: true, payments: true, recording: true, epsTransactions: true },
  });
};

const getProgress = async (id: string) => {
  return prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, paymentStatus: true, studentConfirmed: true, teacherConfirmed: true, completedByAdmin: true, teacherPaid: true },
  });
};

const create = async (data: CreateBookingDTO, userId: string) => {
  console.log("[Booking Service] Persisting booking", {
    userId,
    bookingType: data.bookingType,
    serviceId: data.serviceId,
    teacherId: data.teacherId,
    bookingPrice: data.bookingPrice,
  });
  const booking = await prisma.booking.create({
    data: {
      bookingType: data.bookingType,
      serviceId: data.serviceId,
      customOrderId: data.customOrderId,
      userId,
      teacherId: data.teacherId,
      bookingPrice: data.bookingPrice,
      adminHoldAmount: data.bookingPrice,
      status: "pending",
      paymentStatus: "unpaid",
    },
  });

  const student = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } });
  await notifyUser(
    data.teacherId,
    "booking_requested",
    `${displayNameOf(student)} requested a new booking (${data.bookingType}).`,
    { bookingId: booking.id },
  );

  return booking;
};

const acceptBooking = async (id: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw ApiError.notFound("Booking not found");
  validateTransition(booking.status, "accepted");
  console.log("[Booking Service] Transition", { bookingId: id, from: booking.status, to: "accepted" });

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "accepted" },
  });

  const teacher = await prisma.user.findUnique({ where: { id: booking.teacherId }, select: { name: true, displayName: true } });
  await notifyUser(
    booking.userId,
    "booking_accepted",
    `${displayNameOf(teacher)} accepted your booking request.`,
    { bookingId: id },
  );

  return updated;
};

const startBooking = async (id: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw ApiError.notFound("Booking not found");
  validateTransition(booking.status, "in_progress");
  console.log("[Booking Service] Transition", { bookingId: id, from: booking.status, to: "in_progress" });

  return prisma.booking.update({
    where: { id },
    data: { status: "in_progress" },
  });
};

const studentConfirm = async (id: string, rating?: number, comment?: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw ApiError.notFound("Booking not found");
  console.log("[Booking Service] Student confirmation", { bookingId: id, rating, hasComment: Boolean(comment) });

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      studentConfirmed: true,
      studentReviewRating: rating,
      studentReviewComment: comment,
      studentReviewDate: new Date(),
    },
  });

  const student = await prisma.user.findUnique({ where: { id: booking.userId }, select: { name: true, displayName: true } });
  await notifyUser(
    booking.teacherId,
    "booking_student_confirmed",
    `${displayNameOf(student)} confirmed the session is complete.`,
    { bookingId: id },
  );

  return updated;
};

const teacherConfirm = async (id: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw ApiError.notFound("Booking not found");
  console.log("[Booking Service] Teacher confirmation", { bookingId: id, currentStatus: booking.status, studentConfirmed: booking.studentConfirmed });

  if (booking.teacherConfirmed) {
    throw ApiError.badRequest("Teacher already confirmed this booking");
  }

  const gross = booking.adminHoldAmount;
  const fee = gross * 0.2;
  const net = gross - fee;

  if (booking.studentConfirmed) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { teacherConfirmed: true, status: "completed", completedAt: new Date(), teacherPaid: true },
      });

      await tx.user.update({
        where: { id: booking.teacherId },
        data: { balance: { increment: net }, totalEarnings: { increment: net } },
      });

      await tx.payoutHistory.create({
        data: { userId: booking.teacherId, amount: net, bookingId: id },
      });

      return tx.booking.findUnique({ where: { id } });
    });

    await notifyUser(booking.userId, "booking_completed", "Your booking has been marked as completed.", { bookingId: id });
    return result;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { teacherConfirmed: true, status: "waiting_for_confirmation" },
    });

    return tx.booking.findUnique({ where: { id } });
  });

  const teacher = await prisma.user.findUnique({ where: { id: booking.teacherId }, select: { name: true, displayName: true } });
  await notifyUser(
    booking.userId,
    "booking_waiting_confirmation",
    `${displayNameOf(teacher)} confirmed the session — please confirm to complete it.`,
    { bookingId: id },
  );

  return result;
};

const adminComplete = async (id: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw ApiError.notFound("Booking not found");
  console.log("[Booking Service] Admin completion", { bookingId: id, from: booking.status, to: "completed" });

  const updated = await prisma.booking.update({
    where: { id },
    data: { completedByAdmin: true, status: "completed", completedAt: new Date() },
  });

  await Promise.all([
    notifyUser(booking.userId, "booking_completed", "An admin marked your booking as completed.", { bookingId: id }),
    notifyUser(booking.teacherId, "booking_completed", "An admin marked a booking as completed.", { bookingId: id }),
  ]);

  return updated;
};

export { findAll, findMyBookings, findById, getProgress, create, studentConfirm, teacherConfirm, adminComplete, acceptBooking, startBooking };
