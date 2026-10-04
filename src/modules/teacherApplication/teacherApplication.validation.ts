import { z } from "zod";
import { APPLICATION_STATUSES, CATEGORIES, ENGLISH_LEVELS, GENDERS, TEACHER_TYPES, TEACHING_LANGUAGES } from "../../constants/teacher-options";

const createTeacherApplicationSchema = z.object({
  body: z.object({
    category: z.array(z.enum(CATEGORIES)).min(1, "Select at least one teaching category"),
    teachingLanguages: z.array(z.enum(TEACHING_LANGUAGES)).min(1, "Select at least one teaching language").transform((values) => [...new Set(values)]),
    teacherType: z.enum(TEACHER_TYPES).optional(),
    gender: z.enum(GENDERS),
    phone: z.string().min(5, "Phone is required"),
    nid: z.string().min(4, "NID or passport number is required"),
    bio: z.string().min(30, "Tell us at least a little about your teaching experience"),
    englishLevel: z.enum(ENGLISH_LEVELS).optional(),
    minRate: z.number().positive("Minimum rate must be greater than zero").optional(),
    maxRate: z.number().positive("Maximum rate must be greater than zero").optional(),
    availability: z.array(z.string()).min(1, "Select at least one availability option"),
  }).refine(({ minRate, maxRate }) => minRate == null || maxRate == null || maxRate >= minRate, {
    message: "Maximum rate must be greater than or equal to minimum rate",
    path: ["maxRate"],
  }),
});

const reviewTeacherApplicationSchema = z.object({
  body: z.object({ status: z.enum(APPLICATION_STATUSES.filter((status) => status !== "pending") as ["approved", "rejected"]) }),
  params: z.object({ id: z.uuid() }),
});

export { createTeacherApplicationSchema, reviewTeacherApplicationSchema };
