import prisma from "../../lib/prisma";
import ApiError from "../../utils/ApiError";
import { toTeacherApplication } from "../user/user.dto";
import { notifyAdmins, notifyUser } from "../notification/notification.service";

interface CreateTeacherApplicationInput {
  category: string[];
  teachingLanguages: string[];
  teacherType?: string;
  gender: string;
  phone: string;
  nid: string;
  bio: string;
  englishLevel?: string;
  minRate?: number;
  maxRate?: number;
  availability: string[];
}

const getMine = async (userId: string) => {
  const app = await prisma.teacherApplication.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  return app ? toTeacherApplication(app) : null;
};

const create = async (userId: string, input: CreateTeacherApplicationInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== "student") throw ApiError.badRequest("Only regular users can apply to become a teacher");

  const existing = await getMine(userId);
  const existingStatus = existing?.status?.toLowerCase();
  if (existingStatus === "pending") throw ApiError.conflict("Your teacher application is already under review");
  if (existingStatus === "approved") throw ApiError.conflict("Your teacher application was already approved");

  const { teachingLanguages, ...applicationData } = input;

    const created = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          phone: input.phone,
          nid: input.nid,
          gender: input.gender,
          category: input.category,
        teacherType: input.teacherType,
          englishLevel: input.englishLevel,
          bio: input.bio,
          minRate: input.minRate,
          maxRate: input.maxRate,
          availability: input.availability,
        teachingLanguages: {
          deleteMany: {},
          create: teachingLanguages.map((lang) => ({ lang })),
        },
      },
    });
    return tx.teacherApplication.create({
      data: { userId, ...applicationData, category: input.category, status: "pending" },
      });
    });

  const applicant = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } });
  await notifyAdmins(
    "teacher_application_submitted",
    `${applicant?.displayName || applicant?.name || "A user"} applied to become a teacher.`,
    { applicationId: created.id, userId },
  );

  return toTeacherApplication(created);
};

const listForAdmin = async (status?: string) => {
  const normalizedStatus = status?.toLowerCase();
  const statusValues = normalizedStatus ? [normalizedStatus, normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)] : undefined;
  const applications = await prisma.teacherApplication.findMany({
    where: statusValues ? { status: { in: statusValues } } : undefined,
    include: { user: { select: { id: true, name: true, displayName: true, email: true, photoURL: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  return applications.map(toTeacherApplication);
};

const review = async (applicationId: string, adminId: string, status: "approved" | "rejected") => {
  const application = await prisma.teacherApplication.findUnique({ where: { id: applicationId } });
  if (!application) throw ApiError.notFound("Teacher application not found");
  if (application.status.toLowerCase() !== "pending") throw ApiError.badRequest("This application has already been reviewed");

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.teacherApplication.update({
      where: { id: applicationId },
      data: { status, reviewedAt: new Date(), reviewedById: adminId },
      include: { user: true },
    });

    if (status === "approved") {
      await tx.user.update({
        where: { id: application.userId },
        data: {
          role: "teacher",
          status: "accepted",
          minRate: application.minRate,
          maxRate: application.maxRate,
          availability: application.availability,
        },
      });
    }

    return updated;
  });

  await notifyUser(
    application.userId,
    "teacher_application_reviewed",
    status === "approved"
      ? "Congratulations! Your teacher application has been approved."
      : "Your teacher application was not approved this time.",
    { applicationId, status },
  );

  return toTeacherApplication(updated);
};

export { getMine, create, listForAdmin, review };
