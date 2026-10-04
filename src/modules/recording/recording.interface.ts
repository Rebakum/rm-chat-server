export interface UploadRecordingDTO {
  bookingId?: string;
  callId?: string;
  appointmentId?: string;
  teacherId: string;
  studentId: string;
  videoUrl?: string;
  roomName?: string;
  teacherName?: string;
  studentName?: string;
}

export interface RecordingResponse {
  id: string;
  teacherId: string;
  studentId: string;
  bookingId: string | null;
  callId: string | null;
  appointmentId: string | null;
  roomName: string | null;
  teacherName: string | null;
  studentName: string | null;
  videoUrl: string;
  publicId: string | null;
  duration: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
