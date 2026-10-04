export interface CreateBookingDTO {
  bookingType: "Service" | "Custom";
  serviceId?: string;
  customOrderId?: string;
  teacherId: string;
  bookingPrice: number;
}
