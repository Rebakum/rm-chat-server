import prisma from "../../lib/prisma";
import { SaveTeacherInput, UnsaveTeacherInput } from "./savedTeacher.validation";
import { SavedTeacher } from "./savedTeacher.interface";
import ApiError from "../../utils/ApiError";

const save = async (studentId: string, teacherId: string) => {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { role: true, status: true },
  });

  if (!teacher || teacher.role !== "teacher" || teacher.status !== "accepted") {
    throw ApiError.notFound("Teacher not found");
  }

  const existing = await prisma.savedTeacher.findFirst({
    where: { studentId, teacherId },
  });

  if (existing) {
    throw ApiError.conflict("Teacher already saved");
  }

  return prisma.savedTeacher.create({
    data: { student: { connect: { id: studentId } }, teacher: { connect: { id: teacherId } } },
    include: {
      student: { select: { id: true, name: true, displayName: true, photoURL: true } },
      teacher: { select: { id: true, name: true, displayName: true, photoURL: true } },
    },
  });
};

const unsave = async (studentId: string, teacherId: string) => {
  const existing = await prisma.savedTeacher.findFirst({
    where: { studentId, teacherId },
  });

  if (!existing) {
    throw ApiError.notFound("Teacher not saved");
  }

  return prisma.savedTeacher.delete({
    where: { id: existing.id },
    include: {
      student: { select: { id: true, name: true, displayName: true, photoURL: true } },
      teacher: { select: { id: true, name: true, displayName: true, photoURL: true } },
    },
  });
};

const findAllByStudent = async (studentId: string, query: { page?: number; limit?: number } = {}) => {
  const { page = 1, limit = 20 } = query;
  const { skip, take } = {
    skip: (page - 1) * limit,
    take: limit,
  };

  const [savedTeachers, total] = await Promise.all([
    prisma.savedTeacher.findMany({
      where: { studentId },
      include: {
        student: { select: { id: true, name: true, displayName: true, photoURL: true } },
        teacher: { select: { id: true, name: true, displayName: true, photoURL: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.savedTeacher.count({ where: { studentId } }),
  ]);

  return { savedTeachers, total };
};

export default {
  save,
  unsave,
  findAllByStudent,
};
