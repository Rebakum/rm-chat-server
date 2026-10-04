export const ROLES = ["student", "teacher", "admin"] as const;
export const USER_STATUSES = ["pending", "accepted", "rejected", "banned"] as const;
export const APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;
export const TEACHER_TYPES = ["Online", "In-person", "Both"] as const;
export const ENGLISH_LEVELS = ["Beginner", "Intermediate", "Fluent", "Native", "Advanced"] as const;
export const CATEGORIES = ["Quran", "Arabic", "Hifz", "Tajweed", "Fiqh", "Hadith", "Tafsir", "Aqeedah", "Islamic Studies"] as const;
export const TEACHING_LANGUAGES = ["English", "Arabic", "Bangla", "Hindi", "Urdu", "Turkish", "Malay", "French", "Spanish", "Indonesian"] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type Gender = (typeof GENDERS)[number];
export type TeacherType = (typeof TEACHER_TYPES)[number];
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];
export type Category = (typeof CATEGORIES)[number];
export type TeachingLanguage = (typeof TEACHING_LANGUAGES)[number];
