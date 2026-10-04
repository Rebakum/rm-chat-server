import { randomUUID } from "crypto";
import path from "path";
import { cloudinary } from "../../config/cloudinary";
import { getSupabase } from "../../config/supabase";
import env from "../../config/env";
import logger from "../../lib/logger";
import ApiError from "../../utils/ApiError";

interface UploadResult {
  url: string;
  name: string;
  fileName?: string;
  publicId?: string;
}

const safeFolderPath = (folder: string): string =>
  folder
    .split(/[\\/]+/)
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

export const uploadToSupabase = async (
  file: Express.Multer.File,
  folder = "uploads",
): Promise<UploadResult> => {
  const bucket = (env.SUPABASE_BUCKET || "rahmah-uploads").toLowerCase();
  const originalName = path.basename(file.originalname);
  const extension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const folderPath = safeFolderPath(folder) || "uploads";
  const filePath = `${folderPath}/${randomUUID()}${extension}`;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(bucket).upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return { url: data.publicUrl, name: file.originalname, fileName: filePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Supabase Storage upload failed", {
      bucket,
      filePath,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new ApiError(502, `Supabase Storage upload failed: ${message}`);
  }
};

export const uploadToCloudinary = (file: Express.Multer.File): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "rahmah", resource_type: "auto" },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, name: file.originalname, publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });
};

export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  return cloudinary.uploader.destroy(publicId);
};
