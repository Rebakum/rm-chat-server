import { createHash, randomBytes, randomUUID } from "crypto";
import prisma from "../../lib/prisma";
import ApiError from "../../utils/ApiError";
import { paginate } from "../../utils/pagination";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { notifyUser } from "../notification/notification.service";

const userBriefSelect = {
  id: true,
  name: true,
  displayName: true,
  photoURL: true,
} satisfies Prisma.UserSelect;

const includeParticipants = {
  student: { select: userBriefSelect },
  teacher: { select: userBriefSelect },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithParticipants = Prisma.AppointmentGetPayload<{
  include: typeof includeParticipants;
}>;

/**
 * Generates an unpredictable Jitsi room name: a UUIDv4 (122 bits of CSPRNG
 * output) plus a SHA-256 prefix derived from fresh randomness. Room URLs
 * cannot be enumerated or guessed — knowing one is the capability to join it,
 * so it is only ever returned to the two authenticated participants.
 */
const generateRoomName = (): string => {
  const uuid = randomUUID();
  const prefix = createHash("sha256")
    .update(`${uuid}:${randomBytes(16).toString("hex")}`)
    .digest("hex")
    .slice(0, 16);
  return `rm-${prefix}-${uuid}`;
};

// PENDING sessions (created) may be confirmed, finished or cancelled;
// SCHEDULED ones may be finished or cancelled; terminal states are frozen.
const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["SCHEDULED", "COMPLETED", "CANCELLED"],
  SCHEDULED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Allowed transitions out of PENDING/SCHEDULED — what clients may request. */
export type UpdatableAppointmentStatus = Exclude<AppointmentStatus, "PENDING">;

const schedule = async (
  studentId: string,
  input: { teacherId: string; startTime?: string },
): Promise<AppointmentWithParticipants> => {
  const { teacherId, startTime } = input;

  if (teacherId === studentId) {
    throw ApiError.badRequest("You cannot schedule a session with yourself");
  }

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, role: true },
  });
  if (!teacher) {
    throw ApiError.notFound("Teacher not found");
  }
  if (teacher.role !== "teacher") {
    throw ApiError.badRequest("Selected user is not a teacher");
  }

  let start: Date | null = null;
  if (startTime) {
    start = new Date(startTime);
    // 1-minute grace for clock skew; "start right now" = omit startTime.
    if (start.getTime() < Date.now() - 60_000) {
      throw ApiError.badRequest("startTime must be in the future");
    }
  }

  return prisma.appointment.create({
    data: {
      roomName: generateRoomName(),
      studentId,
      teacherId,
      startTime: start,
      status: "PENDING",
    },
    include: includeParticipants,
  });
};

const getById = async (
  appointmentId: string,
  userId: string,
): Promise<AppointmentWithParticipants> => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: includeParticipants,
  });
  if (!appointment) {
    throw ApiError.notFound("Session not found");
  }
  if (appointment.studentId !== userId && appointment.teacherId !== userId) {
    throw ApiError.forbidden("You are not a participant of this session");
  }
  return appointment;
};

const updateStatus = async (
  appointmentId: string,
  userId: string,
  next: UpdatableAppointmentStatus,
): Promise<AppointmentWithParticipants> => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment) {
    throw ApiError.notFound("Session not found");
  }
  if (appointment.studentId !== userId && appointment.teacherId !== userId) {
    throw ApiError.forbidden("You are not a participant of this session");
  }

  const allowed = STATUS_TRANSITIONS[appointment.status];
  if (!allowed.includes(next)) {
    throw ApiError.badRequest(
      `Cannot move a session from "${appointment.status}" to "${next}"`,
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: next,
      ...(next === "COMPLETED"
        ? { endTime: appointment.endTime ?? new Date() }
        : {}),
    },
    include: includeParticipants,
  });

  // Finishing a session is the appointment flow's "class ended" — tell the
  // participant who isn't the one closing it. STATUS_TRANSITIONS freezes
  // COMPLETED, so this can only ever fire once per appointment.
  if (next === "COMPLETED") {
    const otherId =
      appointment.teacherId === userId ? appointment.studentId : appointment.teacherId;
    await notifyUser(otherId, "class_ended", "Class has ended.", {
      appointmentId: appointment.id,
      roomName: appointment.roomName,
    });
  }

  return updated;
};

const list = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
  status?: AppointmentStatus,
) => {
  const { skip, take } = paginate({ page, limit }, page, limit);
  const where: Prisma.AppointmentWhereInput = {
    OR: [{ studentId: userId }, { teacherId: userId }],
    ...(status ? { status } : {}),
  };

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: includeParticipants,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.appointment.count({ where }),
  ]);
  return { appointments, total };
};

export { schedule, getById, updateStatus, list, generateRoomName };
