export interface CreateTeacherApplicationInput {
  category: string[];
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

export interface TeacherApplication {
  id: string;
  userId: string;
  category: string[];
  teacherType?: string;
  gender: string;
  phone: string;
  nid: string;
  bio: string;
  englishLevel?: string;
  minRate?: number;
  maxRate?: number;
  availability: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  reviewedAt?: Date;
  reviewedById?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  };
}

export interface TeacherApplicationQueryParams {
  page?: number;
  limit?: number;
  status?: "pending" | "approved" | "rejected";
}

export interface ListTeacherApplicationsResponse {
  applications: TeacherApplication[];
  total: number;
}
