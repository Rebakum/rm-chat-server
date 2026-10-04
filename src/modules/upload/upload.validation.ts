import { z } from "zod";

export const deleteUploadSchema = z.object({
  publicId: z.string().min(1, "publicId is required"),
});

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const validateUploadedFile = (file: { mimetype: string; size: number }): string | null => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return `Unsupported file type: ${file.mimetype}`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File exceeds the 10MB limit";
  }
  return null;
};
