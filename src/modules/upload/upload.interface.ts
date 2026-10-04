export interface MulterFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface UploadResult {
  url: string;
  name: string;
  fileName?: string;
  publicId?: string;
}

export type UploadDestination = "cloudinary" | "supabase";
