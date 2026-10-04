import { z } from "zod";
import { userIdSchema } from "../../utils/validators";
import { CATEGORIES, ENGLISH_LEVELS, GENDERS, TEACHER_TYPES, TEACHING_LANGUAGES } from "../../constants/teacher-options";

const emptyToNull = z.string().transform((value) => value.trim() === "" ? null : value);
const username = emptyToNull.refine((value) => value === null || (value.length >= 3 && value.length <= 50), "Username must be 3-50 characters");
const birthdate = emptyToNull.refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Birthdate must use YYYY-MM-DD");
const nullableUrl = emptyToNull.refine((value) => value === null || z.url().safeParse(value).success, "Must be a valid URL");
const nullableText = emptyToNull.nullable().optional();
const relationText = z.array(z.string()).optional();
const relationSkillRows = z.array(z.union([z.string(), z.object({ skill: z.string(), level: z.string().optional() })])).optional();
const coverCrop = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  zoom: z.number(),
  aspect: z.number(),
}).nullable().optional();
const relationRows = {
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string() })).optional(),
  experience: z.array(z.object({ title: z.string(), company: z.string(), duration: z.string(), description: z.string() })).optional(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
};

const updateUserProfileSchema = z.object({
  body: z.object({
    name: nullableText,
    firstname: nullableText,
    lastname: nullableText,
    username: username.optional(),
    displayName: nullableText,
    birthdate: birthdate.optional(),
    gender: z.enum(GENDERS).nullable().optional(),
    phone: nullableText,
    whatsapp: nullableText,
    nid: nullableText,
    nidOrPassportUrl: nullableUrl.optional(),
    presentAddress: nullableText,
    presentCountry: nullableText,
    permanentAddress: nullableText,
    permanentCountry: nullableText,
    bio: nullableText,
    jobTitle: nullableText,
    teacherType: z.enum(TEACHER_TYPES).nullable().optional(),
    category: z.array(z.enum(CATEGORIES)).optional(),
    englishLevel: z.enum(ENGLISH_LEVELS).nullable().optional(),
    facebook: nullableText,
    linkedin: nullableText,
    instagram: nullableText,
    twitter: nullableText,
    youtubeLink: nullableText,
    cvUrl: nullableUrl.optional(),
    photoURL: nullableText,
    coverImage: nullableText,
    coverImageOriginal: nullableText,
    coverCrop,
    liveCameraPhoto: nullableText,
    minRate: z.number().nullable().optional(),
    maxRate: z.number().nullable().optional(),
    teacherTier: nullableText,
    teachingLanguages: z.array(z.enum(TEACHING_LANGUAGES)).transform((values) => [...new Set(values)]).optional(),
    skills: relationSkillRows,
    certificates: relationText,
    galleryImages: z.array(z.string().url()).optional(),
    ...relationRows,
  }),
  params: z.object({ id: userIdSchema }),
});

const updateUserStatusSchema = z.object({
  body: z.object({ status: z.enum(["accepted", "rejected"]) }),
  params: z.object({ id: userIdSchema }),
});

const updateUserSchema = updateUserProfileSchema;

export { updateUserProfileSchema, updateUserSchema, updateUserStatusSchema };
