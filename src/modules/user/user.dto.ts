import type { ApplicationStatus, Category, EnglishLevel, Gender, TeacherType, TeachingLanguage, UserStatus } from "../../constants/teacher-options";
import type { CoverCrop } from "./user.interface";

export interface TeachingLanguageRow { id: string; userId: string; lang: string; }
export interface SkillRow { id: string; userId: string; skill: string; level: string; }
export interface EducationRow { id: string; userId: string; degree: string | null; institution: string | null; year: string | null; }
export interface ExperienceRow { id: string; userId: string; title: string | null; company: string | null; duration: string | null; description: string | null; }
export interface FaqRow { id: string; userId: string; question: string; answer: string; }
export interface CertificateRow { id: string; userId: string; url: string; }
export interface GalleryImageRow { id: string; userId: string; url: string; }

export interface PublicTeacherList {
  id: string;
  userId: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
  photoURL: string | null;
  coverImage: string | null;
  bio: string | null;
  jobTitle: string | null;
  category: string[];
  gender: Gender | string | null;
  teacherType: TeacherType | string | null;
  englishLevel: EnglishLevel | string | null;
  teacherTier: string | null;
  minRate: number | null;
  maxRate: number | null;
  availability: string[];
  presentCountry: string | null;
  permanentCountry: string | null;
  online: boolean;
  verified: boolean;
  youtubeLink: string | null;
  createdAt: string;
  teachingLanguages: TeachingLanguageRow[];
  skills: SkillRow[];
  education: EducationRow[];
  experience: ExperienceRow[];
  faqs: FaqRow[];
  galleryImages: GalleryImageRow[];
}

export type PublicTeacherDetail = PublicTeacherList;

export interface PrivateProfile extends PublicTeacherList {
  email: string;
  emailVerified: boolean;
  role: string;
  status: UserStatus | string;
  firstname: string | null;
  lastname: string | null;
  username: string | null;
  birthdate: string | null;
  phone: string | null;
  whatsapp: string | null;
  nid: string | null;
  nidOrPassportUrl: string | null;
  cvUrl: string | null;
  liveCameraPhoto: string | null;
  coverImageOriginal: string | null;
  coverCrop: CoverCrop | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  balance: number;
  totalEarnings: number;
  paymentStatus: string | null;
  updatedAt: string;
  certificates: CertificateRow[];
  paymentMethods: unknown[];
}

export interface TeacherApplicationDTO {
  id: string;
  userId: string;
  status: ApplicationStatus;
  category: string[];
  teacherType: string | null;
  gender: string;
  phone: string;
  nid: string;
  bio: string;
  englishLevel: string | null;
  minRate: number | null;
  maxRate: number | null;
  availability: string[];
  reviewedAt: string | null;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string | null; displayName: string | null; email: string; photoURL: string | null; createdAt: string };
}

const toIso = (value: unknown): string | null => value == null ? null : new Date(String(value)).toISOString();

export const toCategoryArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
};

const rows = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export function toPublicTeacher(value: Record<string, any>): PublicTeacherList {
  return {
    id: value.id,
    userId: value.id,
    name: value.name ?? null,
    displayName: value.displayName ?? null,
    image: value.image ?? null,
    photoURL: value.photoURL ?? null,
    coverImage: value.coverImage ?? null,
    bio: value.bio ?? null,
    jobTitle: value.jobTitle ?? null,
    category: toCategoryArray(value.category),
    gender: value.gender ?? null,
    teacherType: value.teacherType ?? null,
    englishLevel: value.englishLevel ?? null,
    minRate: value.minRate ?? null,
    maxRate: value.maxRate ?? null,
    availability: Array.isArray(value.availability) ? value.availability : [],
    teacherTier: value.teacherTier ?? null,
    presentCountry: value.presentCountry ?? null,
    permanentCountry: value.permanentCountry ?? null,
    online: Boolean(value.online),
    verified: Boolean(value.verified),
    youtubeLink: value.youtubeLink ?? null,
    createdAt: toIso(value.createdAt) ?? new Date(0).toISOString(),
    teachingLanguages: rows<TeachingLanguageRow>(value.teachingLanguages),
    skills: rows<SkillRow>(value.skills),
    education: rows<EducationRow>(value.education),
    experience: rows<ExperienceRow>(value.experience),
    faqs: rows<FaqRow>(value.faqs),
    galleryImages: rows<GalleryImageRow>(value.galleryImages),
  };
}

export function toPrivateProfile(value: Record<string, any>): PrivateProfile {
  return {
    ...toPublicTeacher(value),
    email: value.email,
    emailVerified: Boolean(value.emailVerified),
    role: value.role,
    status: value.status,
    firstname: value.firstname ?? null,
    lastname: value.lastname ?? null,
    username: value.username ?? null,
    birthdate: value.birthdate ?? null,
    phone: value.phone ?? null,
    whatsapp: value.whatsapp ?? null,
    nid: value.nid ?? null,
    nidOrPassportUrl: value.nidOrPassportUrl ?? null,
    cvUrl: value.cvUrl ?? null,
    liveCameraPhoto: value.liveCameraPhoto ?? null,
    coverImageOriginal: value.coverImageOriginal ?? null,
    coverCrop: value.coverCrop ?? null,
    presentAddress: value.presentAddress ?? null,
    permanentAddress: value.permanentAddress ?? null,
    balance: value.balance ?? 0,
    totalEarnings: value.totalEarnings ?? 0,
    paymentStatus: value.paymentStatus ?? null,
    updatedAt: toIso(value.updatedAt) ?? new Date(0).toISOString(),
    certificates: rows<CertificateRow>(value.certificates),
    paymentMethods: rows(value.paymentMethods),
  };
}

export function toTeacherApplication(value: Record<string, any>): TeacherApplicationDTO {
  return {
    id: value.id,
    userId: value.userId,
    status: String(value.status).toLowerCase() as ApplicationStatus,
    category: toCategoryArray(value.category),
    teacherType: value.teacherType ?? null,
    gender: value.gender,
    phone: value.phone,
    nid: value.nid,
    bio: value.bio,
    englishLevel: value.englishLevel ?? null,
    minRate: value.minRate ?? null,
    maxRate: value.maxRate ?? null,
    availability: Array.isArray(value.availability) ? value.availability : [],
    reviewedAt: toIso(value.reviewedAt),
    reviewedById: value.reviewedById ?? null,
    createdAt: toIso(value.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(value.updatedAt) ?? new Date(0).toISOString(),
    user: value.user ? {
      id: value.user.id,
      name: value.user.name ?? null,
      displayName: value.user.displayName ?? null,
      email: value.user.email,
      photoURL: value.user.photoURL ?? null,
      createdAt: toIso(value.user.createdAt) ?? new Date(0).toISOString(),
    } : undefined,
  };
}
