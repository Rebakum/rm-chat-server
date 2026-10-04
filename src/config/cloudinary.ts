import cloudinaryLib from "cloudinary";
import env from "./env";

const cloudinary = cloudinaryLib.v2;

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

interface UploadOptions {
  resource_type?: string;
  folder?: string;
  chunk_size?: number;
}

export const uploadToCloudinary = async (filePath: string, options: UploadOptions = {}) => {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: options.resource_type || "auto",
    folder: options.folder || "rahmah-institute",
    chunk_size: options.chunk_size || 6000000,
  } as any);
  return result;
};

export const deleteFromCloudinary = async (publicId: string, resourceType = "image") => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

export { cloudinary };
