export const PROFILE_COMPLETION_FIELDS = [
  "firstname",
  "lastname",
  "phone",
  "whatsapp",
  "nid",
  "gender",
  "category",
  "teacherType",
  "englishLevel",
  "bio",
  "presentAddress",
  "presentCountry",
  "permanentAddress",
  "permanentCountry",
  "education",
  "experience",
  "teachingLanguages",
] as const;

export const REQUIRED_TEACHER_FIELDS = ["nid", "phone", "gender", "category"] as const;

export function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return value != null;
}

export function hasRequiredTeacherFields(value: Record<string, unknown>): boolean {
  return REQUIRED_TEACHER_FIELDS.every((field) => isFilled(value[field]));
}

export function getProfileCompletion(value: Record<string, unknown>): { filled: number; total: number; ratio: number; percent: number } {
  const filled = PROFILE_COMPLETION_FIELDS.reduce((count, field) => count + (isFilled(value[field]) ? 1 : 0), 0);
  const total = PROFILE_COMPLETION_FIELDS.length;
  const ratio = filled / total;
  return { filled, total, ratio, percent: Math.round(ratio * 100) };
}
