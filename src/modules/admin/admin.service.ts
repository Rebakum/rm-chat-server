import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { paginate } from "../../utils/pagination";
import { AdminDashboardStats } from "./admin.interface";
import { PUBLIC_USER_SELECT } from "../user/user.service";
import { getProfileCompletion } from "../../utils/profile-completion";

interface UserListFilters {
  role?: string;
  status?: string;
  search?: string;
  sort?: string;
}

const USER_SORT_OPTIONS: Record<string, Prisma.UserOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name: { name: "asc" },
};

const getAllTeachers = async (page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const [teachers, total] = await Promise.all([
    prisma.user.findMany({
      select: PUBLIC_USER_SELECT,
      where: { role: "teacher" },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.user.count({ where: { role: "teacher" } }),
  ]);
  return { teachers, total };
};

const getTeacherById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    include: { servicesAsTeacher: true, freeClassBookings: true },
  });
};

const updateTeacherStatus = async (teacherId: string, status: string) => {
  return prisma.user.update({ where: { id: teacherId }, data: { status } });
};

const updateTeacherPaymentStatus = async (teacherId: string, paymentStatus: string) => {
  return prisma.user.update({ where: { id: teacherId }, data: { paymentStatus } });
};

// Admin override — bypasses the normal OTP flow so support can unblock a
// user whose inbox/provider is unreachable, or revoke a verification that
// was granted in error.
const forceVerifyEmail = async (userId: string, verified: boolean = true) => {
  return prisma.user.update({
    where: { id: userId },
    data: { emailVerified: verified },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
};

const getAllUsers = async (page: number = 1, limit: number = 20, filters: UserListFilters = {}) => {
  const { skip, take } = paginate({}, page, limit);
  const where: Prisma.UserWhereInput = {};
  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { displayName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { username: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        photoURL: true,
        createdAt: true,
        username: true,
        whatsapp: true,
        phone: true,
        verified: true,
        emailVerified: true,
      },
      where,
      orderBy: USER_SORT_OPTIONS[filters.sort ?? ""] ?? USER_SORT_OPTIONS.newest,
      skip, take,
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total };
};

const getDashboardStats = async (): Promise<AdminDashboardStats> => {
  const [totalUsers, totalTeachers, totalStudents, totalBookings, totalRevenue] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "teacher" } }),
    prisma.user.count({ where: { role: "student" } }),
    prisma.booking.count(),
    prisma.booking.aggregate({ _sum: { bookingPrice: true }, where: { paymentStatus: "paid" } }),
  ]);
  return {
    totalUsers, totalTeachers, totalStudents, totalBookings,
    totalRevenue: totalRevenue._sum.bookingPrice || 0,
  };
};

// ---- Rich dashboard overview -----------------------------------------
// One big Promise.all so every count/aggregate/groupBy runs concurrently —
// wall time is bounded by the slowest single query, not the sum of all of
// them (see the earlier performance audit re: Neon round-trip cost).

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const nameOf = (u: { name: string | null; displayName: string | null } | null | undefined) =>
  u?.displayName ?? u?.name ?? "Unknown";

const getDashboardOverview = async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    teachersByStatus,
    studentsByStatus,
    teachersNewThisWeek,
    studentsNewThisWeek,
    onlineUsers,
    bookingsToday,
    bookingsWeek,
    bookingsMonth,
    bookingsTotal,
    bookingsByStatus,
    revenueToday,
    revenueMonth,
    revenueAllTime,
    avgRatingAgg,
    pendingApplications,
    pendingApplicationsCount,
    paymentsAwaitingVerification,
    payoutsPending,
    payoutsPaid,
    lowRatedReviews,
    lowRatedReviewsCount,
    recentUsers,
    recentBookings,
    recentPayments,
    recentReviews,
    topTeacherGroups,
    servicesActive,
    servicesPending,
    servicesTotal,
    recentServices,
    jobsOpen,
    jobsClosed,
    recentJobs,
    enrollmentsByStatus,
    failedPayments24h,
    revenueSeries,
    signupSeries,
    paymentStatusBreakdown,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["status"], where: { role: "teacher" }, _count: true }),
    prisma.user.groupBy({ by: ["status"], where: { role: "student" }, _count: true }),
    prisma.user.count({ where: { role: "teacher", createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { role: "student", createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { online: true } }),
    prisma.booking.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.booking.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.booking.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ["status"], _count: true }),
    prisma.booking.aggregate({ _sum: { bookingPrice: true }, where: { paymentStatus: "paid", createdAt: { gte: todayStart } } }),
    prisma.booking.aggregate({ _sum: { bookingPrice: true }, where: { paymentStatus: "paid", createdAt: { gte: monthAgo } } }),
    prisma.booking.aggregate({ _sum: { bookingPrice: true }, where: { paymentStatus: "paid" } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.teacherApplication.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 3,
      include: { user: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } } },
    }),
    prisma.teacherApplication.count({ where: { status: "pending" } }),
    prisma.payment.aggregate({ _sum: { bookingPrice: true }, _count: true, where: { paymentStatus: "pending_verification" } }),
    prisma.payout.aggregate({ _sum: { amountRequested: true }, _count: true, where: { status: "pending" } }),
    prisma.payout.aggregate({ _sum: { amountPaid: true }, where: { status: "paid" } }),
    prisma.review.findMany({ where: { rating: { lte: 2 } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.review.count({ where: { rating: { lte: 2 } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" }, take: 15,
      select: { id: true, name: true, displayName: true, role: true, createdAt: true },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" }, take: 15,
      include: {
        student: { select: { name: true, displayName: true } },
        teacher: { select: { name: true, displayName: true } },
        service: { select: { title: true } },
      },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" }, take: 15,
      include: { booking: { include: { student: { select: { name: true, displayName: true } }, teacher: { select: { name: true, displayName: true } }, service: { select: { title: true } } } } },
    }),
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.booking.groupBy({ by: ["teacherId"], _count: { _all: true }, _sum: { bookingPrice: true }, orderBy: { _count: { teacherId: "desc" } }, take: 5 }),
    prisma.service.count({ where: { status: "Accepted" } }),
    prisma.service.count({ where: { status: "Pending" } }),
    prisma.service.count(),
    prisma.service.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, status: true, price: true, category: true, createdAt: true } }),
    prisma.job.count({ where: { jobStatus: "Open" } }),
    prisma.job.count({ where: { jobStatus: { not: "Open" } } }),
    prisma.job.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, jobTitle: true, jobStatus: true, category: true, createdAt: true } }),
    prisma.enrollment.groupBy({ by: ["status"], _count: true }),
    prisma.epsTransaction.count({ where: { status: "failed", createdAt: { gte: dayAgo } } }),
    prisma.booking.findMany({ where: { paymentStatus: "paid", createdAt: { gte: monthAgo } }, select: { bookingPrice: true, createdAt: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: monthAgo } }, select: { role: true, createdAt: true } }),
    prisma.payment.groupBy({ by: ["paymentStatus"], _count: true }),
  ]);

  // ---- bucket the two time-series into per-day rows for the last 30 days
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));

  const revenueByDayMap = new Map<string, number>(days.map((d) => [d, 0]));
  for (const b of revenueSeries) {
    const k = dayKey(new Date(b.createdAt));
    if (revenueByDayMap.has(k)) revenueByDayMap.set(k, (revenueByDayMap.get(k) ?? 0) + (b.bookingPrice ?? 0));
  }

  const signupsByDayMap = new Map<string, { teachers: number; students: number }>(
    days.map((d) => [d, { teachers: 0, students: 0 }]),
  );
  for (const u of signupSeries) {
    const k = dayKey(new Date(u.createdAt));
    const row = signupsByDayMap.get(k);
    if (!row) continue;
    if (u.role === "teacher") row.teachers += 1;
    else if (u.role === "student") row.students += 1;
  }

  // ---- resolve top-teacher ids to profiles
  const topTeacherIds = topTeacherGroups.map((g) => g.teacherId);
  const topTeacherUsers = topTeacherIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topTeacherIds } },
        select: { id: true, name: true, displayName: true, photoURL: true },
      })
    : [];
  const topTeacherUserById = new Map(topTeacherUsers.map((u) => [u.id, u]));

  const bookingStatusCount = (status: string) =>
    bookingsByStatus.find((g) => g.status === status)?._count ?? 0;
  const completed = bookingStatusCount("completed");
  const cancelled = bookingStatusCount("cancelled");
  const decided = completed + cancelled;

  const statusCount = <T extends string>(groups: { status: T; _count: number }[], status: T) =>
    groups.find((g) => g.status === status)?._count ?? 0;

  const teacherStatusSum = (status: string) => statusCount(teachersByStatus as any, status as any);

  return {
    kpis: {
      teachers: {
        total: teachersByStatus.reduce((sum, g) => sum + g._count, 0),
        active: teacherStatusSum("accepted"),
        pending: teacherStatusSum("pending"),
        suspended: teacherStatusSum("banned") + teacherStatusSum("rejected"),
        newThisWeek: teachersNewThisWeek,
      },
      students: {
        total: studentsByStatus.reduce((sum, g) => sum + g._count, 0),
        active: statusCount(studentsByStatus as any, "accepted" as any),
        newThisWeek: studentsNewThisWeek,
      },
      bookings: { today: bookingsToday, week: bookingsWeek, month: bookingsMonth, total: bookingsTotal },
      revenue: {
        today: revenueToday._sum.bookingPrice || 0,
        month: revenueMonth._sum.bookingPrice || 0,
        allTime: revenueAllTime._sum.bookingPrice || 0,
      },
      avgRating: Math.round((avgRatingAgg._avg.rating ?? 0) * 10) / 10,
      completionRate: decided > 0 ? Math.round((completed / decided) * 1000) / 10 : 0,
      cancellationRate: decided > 0 ? Math.round((cancelled / decided) * 1000) / 10 : 0,
      onlineUsers,
      totalUsers,
    },
    needsAttention: {
      pendingTeacherApprovals: {
        count: pendingApplicationsCount,
        oldest: pendingApplications.map((a) => ({
          id: a.id,
          userId: a.userId,
          name: nameOf(a.user),
          email: a.user?.email ?? null,
          photoURL: a.user?.photoURL ?? null,
          createdAt: a.createdAt,
        })),
      },
      paymentsAwaitingVerification: {
        count: paymentsAwaitingVerification._count,
        totalAmount: paymentsAwaitingVerification._sum.bookingPrice || 0,
      },
      payoutsPending: {
        count: payoutsPending._count,
        totalAmount: payoutsPending._sum.amountRequested || 0,
      },
      bookingsPending: bookingStatusCount("pending") + bookingStatusCount("waiting_for_confirmation"),
      bookingsCancelled: cancelled,
      lowRatedReviews: {
        count: lowRatedReviewsCount,
        items: lowRatedReviews.map((r) => ({ id: r.id, name: r.name, rating: r.rating, description: r.description, createdAt: r.createdAt })),
      },
    },
    charts: {
      revenueByDay: days.map((d) => ({ date: d, amount: Math.round((revenueByDayMap.get(d) ?? 0) * 100) / 100 })),
      bookingsByStatus: bookingsByStatus.map((g) => ({ status: g.status, count: g._count })),
      signupsByDay: days.map((d) => ({ date: d, ...(signupsByDayMap.get(d) ?? { teachers: 0, students: 0 }) })),
      paymentStatusBreakdown: paymentStatusBreakdown.map((g) => ({ status: g.paymentStatus, count: g._count })),
    },
    activity: [
      ...recentUsers.map((u) => ({
        type: "signup" as const,
        message: `${nameOf(u)} joined as a ${u.role}`,
        at: u.createdAt,
        refId: u.id,
      })),
      ...recentBookings.map((b) => ({
        type: "booking" as const,
        message: `${nameOf(b.student)} booked ${b.service?.title ?? "a lesson"} with ${nameOf(b.teacher)} — ${b.status}`,
        at: b.createdAt,
        refId: b.id,
      })),
      ...recentPayments.map((p) => ({
        type: "payment" as const,
        message: `Payment of $${p.bookingPrice ?? 0} from ${nameOf(p.booking?.student)} — ${p.paymentStatus}`,
        at: p.createdAt,
        refId: p.bookingId,
      })),
      ...recentReviews.map((r) => ({
        type: "review" as const,
        message: `${r.name ?? "Someone"} posted a ${r.rating}★ review`,
        at: r.createdAt,
        refId: r.id,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 30),
    topTeachers: topTeacherGroups.map((g) => {
      const u = topTeacherUserById.get(g.teacherId);
      return {
        id: g.teacherId,
        name: nameOf(u),
        photoURL: u?.photoURL ?? null,
        bookings: g._count._all,
        earnings: g._sum.bookingPrice || 0,
      };
    }),
    recentTransactions: recentPayments.map((p) => ({
      id: p.id,
      amount: p.bookingPrice || 0,
      status: p.paymentStatus,
      studentName: nameOf(p.booking?.student),
      teacherName: nameOf(p.booking?.teacher),
      serviceTitle: p.booking?.service?.title ?? p.serviceTitle ?? null,
      createdAt: p.createdAt,
    })),
    finance: {
      totalCollected: revenueAllTime._sum.bookingPrice || 0,
      pendingVerification: paymentsAwaitingVerification._sum.bookingPrice || 0,
      paidOut: payoutsPaid._sum.amountPaid || 0,
      outstandingPayouts: payoutsPending._sum.amountRequested || 0,
    },
    content: {
      services: { active: servicesActive, pending: servicesPending, total: servicesTotal, recent: recentServices },
      jobs: { open: jobsOpen, closed: jobsClosed, total: jobsOpen + jobsClosed, recent: recentJobs },
      enrollments: {
        total: enrollmentsByStatus.reduce((sum, g) => sum + g._count, 0),
        byStatus: enrollmentsByStatus.map((g) => ({ status: g.status, count: g._count })),
      },
    },
    systemHealth: {
      failedPayments24h,
      dbOk: true,
    },
  };
};

// ---- Sidebar badge counts ---------------------------------------------
// Deliberately separate from getDashboardOverview (which runs ~35 queries
// and is only meant to be fetched once, on the dashboard page itself) — the
// sidebar renders on every admin route, so this stays to the four counts it
// actually needs.
const getSidebarBadges = async () => {
  const [pendingTeacherApprovals, paymentsAwaitingVerification, bookingsPending, unreadChatGroups] = await Promise.all([
    prisma.teacherApplication.count({ where: { status: "pending" } }),
    prisma.payment.count({ where: { paymentStatus: "pending_verification" } }),
    prisma.booking.count({ where: { status: { in: ["pending", "waiting_for_confirmation"] } } }),
    prisma.message.groupBy({ by: ["chatId"], where: { read: false }, _count: true }),
  ]);

  return {
    pendingTeacherApprovals,
    paymentsAwaitingVerification,
    bookingsPending,
    unreadChats: unreadChatGroups.length,
  };
};

// ---- Registry audit ----------------------------------------------------
// Finds accounts whose selected profile fields are empty — a data-integrity
// sweep, not a marketing/admissions list. "Empty" means null or "" for
// these plain scalar String? columns on User.
export const REGISTRY_AUDIT_FIELDS = [
  "displayName", "photoURL", "firstname", "lastname", "phone", "bio", "birthdate",
  "jobTitle", "nid", "presentAddress", "permanentAddress", "cvUrl", "nidOrPassportUrl",
  "facebook", "linkedin", "whatsapp",
] as const;

interface RegistryAuditParams {
  role?: string;
  dateFrom?: string;
  dateTo?: string;
  emptyFields?: string[];
  unverifiedOnly?: boolean;
  page?: number;
  limit?: number;
}

const getRegistryAudit = async (params: RegistryAuditParams) => {
  const { skip, take } = paginate({}, params.page ?? 1, params.limit ?? 20);
  const where: Prisma.UserWhereInput = { role: params.role || "student" };

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
    };
  }
  if (params.unverifiedOnly) where.verified = false;

  const validFields = (params.emptyFields ?? []).filter((f): f is (typeof REGISTRY_AUDIT_FIELDS)[number] =>
    (REGISTRY_AUDIT_FIELDS as readonly string[]).includes(f),
  );
  if (validFields.length > 0) {
    where.AND = validFields.map(
      (field) => ({ OR: [{ [field]: null }, { [field]: "" }] }) as Prisma.UserWhereInput,
    );
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, displayName: true, email: true, username: true,
        verified: true, createdAt: true,
        firstname: true, lastname: true, phone: true, whatsapp: true, nid: true,
        gender: true, category: true, teacherType: true, englishLevel: true, bio: true,
        presentAddress: true, presentCountry: true, permanentAddress: true, permanentCountry: true,
        education: { select: { id: true } },
        experience: { select: { id: true } },
        teachingLanguages: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.user.count({ where }),
  ]);

  const items = users.map((u) => ({
    id: u.id,
    name: u.displayName ?? u.name ?? "Unnamed",
    email: u.email,
    username: u.username,
    verified: u.verified,
    createdAt: u.createdAt,
    profileCompletion: getProfileCompletion(u).percent,
  }));

  return { items, total };
};

export { getAllTeachers, getTeacherById, updateTeacherStatus, updateTeacherPaymentStatus, getAllUsers, getDashboardStats, getDashboardOverview, getSidebarBadges, getRegistryAudit, forceVerifyEmail };
