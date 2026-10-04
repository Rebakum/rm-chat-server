import type { Role, UserStatus as Status } from "../../constants/teacher-options";

export interface CreateUserDTO {
  email: string;
  name?: string;
  role?: Role;
  status?: Status;
  image?: string;
}

export interface CoverCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  aspect: number;
}

export interface UpdateUserDTO {
  firstname?: string;
  lastname?: string;
  displayName?: string;
  phone?: string;
  whatsapp?: string;
  gender?: string;
  bio?: string;
  category?: string[];
  teacherType?: string;
  englishLevel?: string;
  minRate?: number;
  maxRate?: number;
  presentAddress?: string;
  presentCountry?: string;
  permanentAddress?: string;
  permanentCountry?: string;
  coverImage?: string | null;
  coverImageOriginal?: string | null;
  coverCrop?: CoverCrop | null;
}

export interface TeacherEligibilityResult {
  eligible: boolean;
  profileCompletion: number;
  missingFields: string[];
}
