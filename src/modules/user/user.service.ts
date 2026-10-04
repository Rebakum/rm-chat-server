import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { User, Prisma } from "@prisma/client";
import ApiError from "../../utils/ApiError";
import { getProfileCompletion, hasRequiredTeacherFields, isFilled } from "../../utils/profile-completion";
import { toPrivateProfile, toPublicTeacher } from "./user.dto";

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  displayName: true,
  image: true,
  photoURL: true,
  coverImage: true,
  coverImageOriginal: true,
  coverCrop: true,
  bio: true,
  jobTitle: true,
  gender: true,
  category: true,
  teacherType: true,
  englishLevel: true,
  minRate: true,
  maxRate: true,
  availability: true,
  teacherTier: true,
  presentCountry: true,
  permanentCountry: true,
  online: true,
  onlineAt: true,
  offlineAt: true,
  lastSeen: true,
  role: true,
  status: true,
  verified: true,
  facebook: true,
  linkedin: true,
  instagram: true,
  twitter: true,
  youtubeLink: true,
  createdAt: true,
} as const;

const ADMIN_USER_SELECT = { ...PUBLIC_USER_SELECT, email: true } as const;

// Every one of these seven relation selects becomes its own round trip to
// the database (Prisma issues a separate query per relation under `select`),
// so a "full" private-profile fetch was paying for 8 sequential DB round
// trips even when the caller only needed a couple of scalar fields (e.g.
// AuthContext just reads `profile.photoURL`). Measured locally: this was
// costing ~3s per call on this project's Neon-hosted database — and it ran
// on *every* login and every session restore, since those paths fetch the
// caller's own profile (isSelf). Split into a lean tier (scalars only, used
// by auth/session/chat-header contexts) and a full tier (adds the seven
// relations, used only where they're actually rendered/edited — My Profile
// and Profile Settings).
const PRIVATE_USER_SELECT_LEAN = {
  ...PUBLIC_USER_SELECT,
  email: true,
  emailVerified: true,
  firstname: true,
  lastname: true,
  birthdate: true,
  phone: true,
  whatsapp: true,
  nid: true,
  nidOrPassportUrl: true,
  cvUrl: true,
  liveCameraPhoto: true,
  presentAddress: true,
  permanentAddress: true,
  balance: true,
  totalEarnings: true,
  paymentStatus: true,
  paymentMethods: true,
  updatedAt: true,
} as const;

const PRIVATE_USER_SELECT_FULL = {
  ...PRIVATE_USER_SELECT_LEAN,
  galleryImages: { orderBy: { id: "asc" } },
  teachingLanguages: { orderBy: { id: "asc" } },
  skills: { orderBy: { id: "asc" } },
  education: { orderBy: { id: "asc" } },
  experience: { orderBy: { id: "asc" } },
  faqs: { orderBy: { id: "asc" } },
  certificates: { orderBy: { id: "asc" } },
} as const;

const findAll = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: ADMIN_USER_SELECT,
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.user.count(),
  ]);
  return { users, total };
};

const findById = async (id: string, requestUserId?: string, requestUserRole?: string, full = false) => {
  const isSelf = requestUserId === id;
  const isAdmin = requestUserRole === "admin";
  const isPrivate = isSelf || isAdmin;

  const user = await prisma.user.findUnique({
    where: { id },
    select: isPrivate ? (full ? PRIVATE_USER_SELECT_FULL : PRIVATE_USER_SELECT_LEAN) : PUBLIC_USER_SELECT,
  });
  if (!user) return null;
  return isPrivate ? toPrivateProfile(user) : toPublicTeacher(user);
};

const ensureUsernameAvailable = async (username: Prisma.UserUpdateInput["username"], excludeId?: string): Promise<Prisma.UserUpdateInput["username"]> => {
  if (typeof username !== "string") return username;
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;

  const existing = await prisma.user.findFirst({
    where: {
      username: normalized,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict("Username is already taken");
  return normalized;
};

const updateById = async (id: string, data: Prisma.UserUpdateInput) => {
  if ("username" in data) data.username = await ensureUsernameAvailable(data.username, id);
  try {
    return await prisma.user.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw ApiError.conflict("Username is already taken");
    }
    throw error;
  }
};

const updateStatus = async (id: string, status: string, actorId: string) => {
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, displayName: true, role: true, status: true },
    });
    if (!target) throw ApiError.notFound("User not found");
    if (target.role === "admin") {
      throw ApiError.forbidden("Administrator accounts cannot be blocked from this screen");
    }

    const updated = await tx.user.update({
      where: { id },
      data: {
        status,
        ...(status === "rejected" || status === "banned"
          ? { online: false, offlineAt: new Date() }
          : {}),
      },
    });
    if (target.status !== status) {
      const displayName = target.displayName || target.name || target.email;
      await tx.moderatorAuditLog.create({
        data: {
          actorId,
          action: status === "accepted" ? "USER_ACCEPTED" : "USER_REJECTED",
          targetUserId: id,
          metadata: {
            displayName,
            email: target.email,
            previousStatus: target.status,
            status,
            detail: `${displayName}'s access was ${status}.`,
          },
        },
      });
    }
    return { user: updated, changed: target.status !== status };
  });
};

const remove = async (id: string) => prisma.user.delete({ where: { id } });

const getOnlineUsers = async () => {
  return prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    where: { online: true },
  });
};

const getOnlineTeachers = async () => {
  return prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    where: { online: true, role: "teacher", status: "accepted", emailVerified: true },
  });
};

const getVerifiedStudents = async () => {
  return prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    where: { role: "student", emailVerified: true },
  });
};

const getEligibleTeachers = async () => {
  const teachers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      displayName: true,
      email: true,
      photoURL: true,
      coverImage: true,
      jobTitle: true,
      birthdate: true,
      category: true,
      teacherType: true,
      englishLevel: true,
      teacherTier: true,
       minRate: true,
       maxRate: true,
       availability: true,
      phone: true,
      nid: true,
      gender: true,
      bio: true,
      youtubeLink: true,
      createdAt: true,
      presentAddress: true,
      presentCountry: true,
      permanentAddress: true,
      permanentCountry: true,
       online: true,
       verified: true,
       whatsapp: true,
      firstname: true,
      lastname: true,
      teachingLanguages: true,
      skills: true,
      education: true,
      experience: true,
      faqs: true,
      galleryImages: true,
    },
    where: { role: "teacher", status: "accepted", emailVerified: true, category: { isEmpty: false } },
  });

  const filteredTeachers = teachers.filter((t) => {
    const completion = getProfileCompletion(t);
    return hasRequiredTeacherFields(t) && completion.ratio >= 0.75;
  });

  return filteredTeachers.map((teacher) => toPublicTeacher(teacher));
};

const getEligibleTeacherById = async (id: string) => {
  const teacher = await prisma.user.findFirst({
    select: {
      id: true,
      username: true,
      name: true,
      displayName: true,
      photoURL: true,
      coverImage: true,
      jobTitle: true,
      birthdate: true,
      category: true,
      teacherType: true,
      englishLevel: true,
      teacherTier: true,
      minRate: true,
      maxRate: true,
      gender: true,
      bio: true,
      youtubeLink: true,
      createdAt: true,
      presentAddress: true,
      presentCountry: true,
      permanentAddress: true,
      permanentCountry: true,
      online: true,
      verified: true,
      teachingLanguages: true,
      skills: true,
      education: true,
      experience: true,
      faqs: true,
      galleryImages: true,
    },
    where: { id, role: "teacher", status: "accepted", emailVerified: true },
  });

  if (!teacher) return null;

  if (!isFilled(teacher.gender) || !isFilled(teacher.category)) return null;

  return toPublicTeacher(teacher);
};

const getTeacherDashboard = async (teacherId: string) => {
  const [teacher, bookings, services, payoutHistory] = await Promise.all([
    prisma.user.findUnique({
      where: { id: teacherId },
       select: { id: true, name: true, displayName: true, email: true, status: true, verified: true, balance: true, totalEarnings: true, photoURL: true, gender: true, role: true, presentAddress: true, presentCountry: true, permanentAddress: true, permanentCountry: true, phone: true, whatsapp: true, bio: true, category: true, teacherType: true, minRate: true, maxRate: true, availability: true, youtubeLink: true, facebook: true, instagram: true, linkedin: true },
    }),
    prisma.booking.findMany({
      where: { teacherId },
      include: { student: { select: { id: true, name: true, displayName: true, photoURL: true } }, service: { select: { id: true, title: true, price: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.service.findMany({
      where: { teacherId },
      select: { id: true, title: true, price: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.payoutHistory.findMany({
      where: { userId: teacherId },
      orderBy: { date: "desc" },
      take: 6,
    }),
  ]);

  if (!teacher) return null;

  const counts = await prisma.booking.groupBy({
    by: ["status"],
    where: { teacherId },
    _count: { _all: true },
  });

  return {
    teacher,
    bookings,
    services,
    payoutHistory,
    counts: Object.fromEntries(counts.map((item) => [item.status.toLowerCase(), item._count._all])),
  };
};

export {
  findAll, findById,
  updateById, updateStatus, remove, getOnlineUsers,
  getOnlineTeachers, getVerifiedStudents, getEligibleTeachers,
  getEligibleTeacherById,
  getTeacherDashboard,
  PUBLIC_USER_SELECT, PRIVATE_USER_SELECT_LEAN, PRIVATE_USER_SELECT_FULL,
};
