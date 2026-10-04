export interface CreateCustomOrderDTO {
  subject: string;
  totalHours: number;
  hourlyRate: number;
  totalPrice: number;
  startDate?: string;
  endDate?: string;
  teacherId: string;
}
