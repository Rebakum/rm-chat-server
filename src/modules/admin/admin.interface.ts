import type { UserStatus as Status } from "../../constants/teacher-options";
type PaymentStatus = "pending" | "verified" | "rejected";

export interface TeacherUpdateDTO {
  status?: Status;
  paymentStatus?: PaymentStatus;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalBookings: number;
  totalRevenue: number;
}
