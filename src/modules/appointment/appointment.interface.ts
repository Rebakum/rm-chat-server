// DTOs for the appointment (scheduled 1:1 session) module.

export type AppointmentStatusKind = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface ScheduleAppointmentDTO {
  teacherId: string;
  /** ISO 8601 datetime. Omit to create an instant "start now" session. */
  startTime?: string;
}

export interface AppointmentUserBrief {
  id: string;
  name: string | null;
  displayName: string | null;
  photoURL: string | null;
}
